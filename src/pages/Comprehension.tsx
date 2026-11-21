import { ArrowLeft, ArrowRight, Check, FastForward, Headphones, ListPlus, Play, RotateCcw, Square, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { buildDialogueSsmlBatches } from "../ai/ssml";
import { makeComprehension } from "../ai/tasks";
import { speakerVoices, ttsOn, ttsSsmlUrl, ttsUrl } from "../ai/tts";
import { play, stopAudio } from "../lib/audio";
import { countWords } from "../lib/essay";
import { BETWEEN_PLAYS, clock, COMP_LABEL, exercisePoints, FORM_SPEC, outOf25, PAPER, QSKILL_LABEL, READ_MINUTES, REAL_WPM, speakerIndex, speechChunks, speechTurns, TOPICS, topicOf, type CompExercise, type CompForm, type CompKind } from "../lib/exam";
import { accentNames, sentencesOf, CAUSE_LABEL, CAUSE_TIP, causeFromSkill, MISS_CAUSES, missStats, pickVoices, skillStats, type CompMiss, type DocVoices, type MissCause, type VoiceMode } from "../lib/listening";
import { PRESET_PAPERS } from "../lib/exam-presets";
import { LISTENING_NOISE, startListeningNoise, stopListeningNoise, type ListeningNoiseId } from "../lib/sound";
import { addAttempt, deletePaper, savePaper, starPaper, useBank, wrongKeys, type BankPaper } from "../store/exam-bank";
import { addMisses, setMissCause } from "../store/misses";
import { TranscriptWords } from "../ui/TranscriptWords";
import { IntensiveDoc } from "./Intensive";
import { RealListening } from "./RealListening";
import "../styles/listening.css";
import { missLinksFor } from "../lib/miss-links";
import { href } from "../lib/router";
import { useTimer } from "../lib/timer";
import { logExam } from "../store/essays";
import { useStore } from "../store/store";
import { toast } from "../ui/Toast";

const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const num = (n: number) => String(n).replace(".", ",");

/** The voice's own pace (words per minute at normal speed), measured while it reads and kept on this device. */
const PACE_KEY = "fb2.listen.wpm";
const readPace = () => {
  try {
    const n = Number(localStorage.getItem(PACE_KEY));
    return n > 80 && n < 320 ? n : 0;
  } catch {
    return 0;
  }
};
/** How much to speed the voice up or slow it down to reach the pace of the official recordings. */
const rateFor = (wpm: number, slow: boolean) => Math.min(1.4, Math.max(0.8, wpm ? REAL_WPM / wpm : 1)) * (slow ? 0.85 : 1);

/** Listening choices kept on this device: which voices read, how the people speak, and ambient noise bed. */
const VOICE_KEY = "fb2.listen.voices";
const STYLE_KEY = "fb2.listen.style";
const NOISE_KEY = "fb2.listen.noise";
const NOISE_IDS = LISTENING_NOISE.map((n) => n.id) as readonly ListeningNoiseId[];
const readKey = <T extends string>(key: string, ok: readonly T[], d: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : d;
  } catch {
    return d;
  }
};
const writeKey = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* not remembered */
  }
};
const VOICE_MODES: [VoiceMode, string][] = [
  ["mixed", "多口音（法、加、比、瑞）"],
  ["france", "法国口音，多换几个声音"],
  ["fixed", "只用我设置的两个声音"],
];
const paperTopics = (p: Pick<BankPaper, "exs">) => [...new Set(p.exs.map((x) => topicOf(x.topic)?.zh ?? x.title))].join("、");

type Phase = "setup" | "making" | "work" | "done";
type What = CompForm | "paper";

/**
 * 听力理解 / 应试阅读, in the form of the exam (new format): a whole paper is three exercises worth 9 + 9 + 7 points,
 * every question has three options and is worth 1 or 1.5 points. Listening follows the exam's rhythm: time to
 * read the questions, the recording (twice for a long one, once for the short ones), time to answer. The
 * documents are written by the AI and read by a synthetic voice; the score is logged, memory state is not touched.
 */
export function ComprehensionStudio({ kind, onExit }: { kind: CompKind; onExit: () => void }) {
  const ai = useAiConfig();
  const log = (useStore((s) => s.progress.examLog) ?? []).filter((r) => r.part === kind);
  const misses = useStore((s) => s.progress.compMisses) ?? [];
  const bank = useBank();
  const listen = kind === "listen";
  const azure = ready.tts(ai);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => readKey(VOICE_KEY, ["mixed", "france", "fixed"], "mixed"));
  const [style, setStyle] = useState<"radio" | "natural">(() => readKey(STYLE_KEY, ["radio", "natural"], "natural"));
  const [noise, setNoise] = useState<ListeningNoiseId>(() => readKey(NOISE_KEY, NOISE_IDS, "off"));
  const [real, setReal] = useState(false);
  /** The paper being done: its id in the bank, and the question keys asked when only the missed ones are. */
  const [paper, setPaper] = useState<{ id: string; level: "B1" | "B2"; asked?: string[] } | null>(null);
  const [voices, setVoices] = useState<DocVoices[][]>([]);
  const [finishedAt, setFinishedAt] = useState(0);
  const [causes, setCauses] = useState<Record<string, MissCause>>({});
  const [panel, setPanel] = useState<string | null>(null);
  const forms: What[] = ["paper", ...new Set(PAPER[kind])];
  const [topic, setTopic] = useState("random");
  const [level, setLevel] = useState<"B1" | "B2">("B2");
  const [what, setWhat] = useState<What>("paper");
  const [timed, setTimed] = useState(true);
  const [slow, setSlow] = useState(false);
  const [wpm, setWpm] = useState(readPace);
  const measured = useRef({ words: 0, sec: 0 });
  const [phase, setPhase] = useState<Phase>("setup");
  const [made, setMade] = useState(0);
  const [exs, setExs] = useState<CompExercise[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [heard, setHeard] = useState<Record<number, boolean>>({});
  const [pace, setPace] = useState<{ e: number; label: string; left: number | null } | null>(null);
  const [showZh, setShowZh] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const run = useRef(0);
  const skip = useRef<(() => void) | null>(null);
  const timer = useTimer();

  const halt = () => {
    run.current++;
    skip.current?.();
    stopAudio();
    setPace(null);
  };

  useEffect(
    () => () => {
      ctrl.current?.abort();
      run.current++;
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);

  /** Start a paper: voices for every document, answers cleared, the reading clock started. */
  const begin = (list: CompExercise[], p: { id: string; level: "B1" | "B2"; asked?: string[] }) => {
    const mode = azure && voiceMode !== "fixed" ? voiceMode : null;
    setVoices(list.map((ex) => ex.docs.map(() => (mode ? pickVoices(mode) : { voices: speakerVoices(), accents: [] }))));
    setExs(list);
    setPaper(p);
    setPicked({});
    setHeard({});
    setCauses({});
    setPanel(null);
    setShowZh(false);
    setPhase("work");
    const minutes = list.length > 1 ? READ_MINUTES.paper : list[0].form === "opinions" ? READ_MINUTES.opinions : READ_MINUTES.long;
    if (!listen && timed) timer.start(Math.round(minutes * (p.asked ? Math.max(0.25, p.asked.length / list.reduce((n, x) => n + x.questions.length, 0)) : 1) * 60));
  };

  const redo = (p: BankPaper, wrongOnly: boolean) => {
    const asked = wrongOnly ? wrongKeys(p, bank.attempts[p.id]?.[0]) : undefined;
    if (wrongOnly && !asked?.length) return toast("上次这套题没有错题", "info");
    setLevel(p.level);
    begin(p.exs, { id: p.id, level: p.level, asked });
  };

  const make = async () => {
    const list = what === "paper" ? PAPER[kind] : [what];
    const pool = [...TOPICS].sort(() => Math.random() - 0.5);
    const c = new AbortController();
    ctrl.current = c;
    setPhase("making");
    setMade(0);
    try {
      const out: CompExercise[] = [];
      for (const [k, form] of list.entries()) {
        const t = topic === "random" || k > 0 ? pool[k % pool.length] : topicOf(topic)!;
        out.push(await makeComprehension({ kind, form, topic: t, level, style }, c.signal));
        if (c.signal.aborted) return;
        setMade(k + 1);
      }
      // kept in the 题库 on this device, to be done again later without asking the AI
      const id = await savePaper({ kind, level, ...(listen ? { style } : {}), exs: out });
      begin(out, { id, level });
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
  const say = async (text: string, mine: number, dv?: DocVoices) => {
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
    try {
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

  /** One listening exercise at the exam's rhythm. */
  const perform = async (e: number) => {
    const ex = exs[e];
    const spec = FORM_SPEC[ex.form];
    const mine = ++run.current;
    const alive = () => run.current === mine;
    for (const [d, doc] of ex.docs.entries()) {
      const name = ex.docs.length > 1 ? `录音 ${d + 1}：` : "";
      await pause(e, `${name}读题`, spec.read, mine);
      for (let n = 1; n <= spec.plays && alive(); n++) {
        setPace({ e, label: `${name}${spec.plays > 1 ? `第 ${n} 遍` : "只放一遍"}`, left: null });
        if (!(await say(doc.text, mine, voices[e]?.[d]))) break;
        if (n < spec.plays) await pause(e, `${name}两遍之间`, BETWEEN_PLAYS, mine);
      }
      if (!alive()) return;
      await pause(e, `${name}作答`, spec.answer, mine);
      if (!alive()) return;
    }
    setHeard((h) => ({ ...h, [e]: true }));
    setPace(null);
  };

  const replay = async (e: number, d: number) => {
    const mine = ++run.current;
    setPace({ e, label: "重听", left: null });
    await say(exs[e].docs[d].text, mine, voices[e]?.[d]);
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
  const all = exs.flatMap((ex, e) => ex.questions.map((q, k) => ({ q, key: `${e}-${k}` }))).filter(({ key }) => isAsked(key));
  const total = askedSet ? all.reduce((n, { q }) => n + q.pts, 0) : exs.reduce((n, ex) => n + exercisePoints(ex), 0);
  const score = all.reduce((n, { q, key }) => n + (picked[key] === q.answer ? q.pts : 0), 0);
  const answered = all.filter(({ key }) => picked[key] !== undefined).length;

  const finish = () => {
    halt();
    timer.stop();
    const at = Date.now();
    // a redo of the missed questions only is not a score of the paper
    if (!askedSet) logExam({ part: kind, what: exs.length > 1 ? "paper" : exs[0].topic, score, total });
    const missed: CompMiss[] = all
      .filter(({ q, key }) => picked[key] !== q.answer)
      .map(({ q, key }) => ({ at, part: kind, q: key, cause: causeFromSkill(q.skill) ?? (listen ? "heard" : "paraphrase"), ...(q.skill ? { skill: q.skill } : {}) }));
    addMisses(missed);
    setCauses(Object.fromEntries(missed.map((m) => [m.q!, m.cause])));
    if (paper) void addAttempt(paper.id, { at, picked, score, total, ...(paper.asked ? { asked: paper.asked } : {}) });
    setFinishedAt(at);
    setPhase("done");
  };

  const blame = (key: string, cause: MissCause) => {
    setCauses((c) => ({ ...c, [key]: cause }));
    setMissCause(finishedAt, key, cause);
  };

  if (real) return <RealListening onExit={() => setReal(false)} />;

  if (phase === "setup" || phase === "making") {
    const making = phase === "making";
    const papers = [...PRESET_PAPERS, ...bank.papers].filter((p) => p.kind === kind);
    const stats = missStats(misses, kind);
    // right / asked by kind of question, over the last attempt at every paper of the bank
    const bySkill = skillStats(
      papers.flatMap((p) => {
        const a = bank.attempts[p.id]?.find((x) => !x.asked);
        return a ? p.exs.flatMap((ex, e) => ex.questions.map((q, k) => ({ skill: q.skill, right: a.picked[`${e}-${k}`] === q.answer }))) : [];
      }),
    );
    const count = what === "paper" ? PAPER[kind].length : 1;
    return (
      <div className="page practice">
        <header className="page-head">
          <button className="link deck-back" onClick={onExit}>
            <ArrowLeft size={16} /> 返回练习
          </button>
          <p className="eyebrow">
            {COMP_LABEL[kind]} · {listen ? "Compréhension de l'oral" : "Compréhension des écrits"}
          </p>
          <h1 className="display">{listen ? "只听，不看。" : "读得快，也读得准。"}</h1>
          <p className="lede">
            {listen
              ? "和考试一样：一套三个练习共 25 分。两段长录音各听两遍，三段短录音各听一遍；每题三个选项，按难度占 0.5 至 2.5 分不等。先读题，再听，按考试的停顿时间作答。"
              : "和考试一样：一套三个练习共 25 分，限时 1 小时。两篇报刊文章各 7 题，再加一组「这是谁的观点」；每题三个选项，按难度占 0.5 至 2.5 分不等。"}
          </p>
          {listen && (
            <div className="exam-notice" role="note">
              <p>
                <b>TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。</b>
                <span className="muted small">真实 DELF B2 录音来自法国电台（带现场底噪、语流吞连与多人抢话）。考前请务必结合「真实材料精听」（RFI / TV5Monde / France Culture）及官方样题脱敏。</span>
              </p>
              <button className="btn btn-ghost" onClick={() => setReal(true)}>
                <Headphones size={15} /> 去听真实电台
              </button>
            </div>
          )}
        </header>
        <section className="panel exam-setup">
          <h3 className="eyebrow">练什么</h3>
          <div className="segmented segmented-wide">
            {forms.map((f) => (
              <button key={f} className={what === f ? "is-on" : ""} onClick={() => setWhat(f)} aria-pressed={what === f}>
                {f === "paper" ? "整套（25 分）" : FORM_SPEC[f].zh}
              </button>
            ))}
          </div>
          <h3 className="eyebrow">话题</h3>
          <div className="exam-chips">
            <button className={topic === "random" ? "is-on" : ""} onClick={() => setTopic("random")} aria-pressed={topic === "random"}>
              随机
            </button>
            {TOPICS.map((t) => (
              <button key={t.id} className={topic === t.id ? "is-on" : ""} onClick={() => setTopic(t.id)} aria-pressed={topic === t.id}>
                {t.zh}
              </button>
            ))}
          </div>
          {what === "paper" && topic !== "random" && <p className="muted small">整套题的第一个练习用所选话题，后两个换别的话题。</p>}
          <h3 className="eyebrow">难度</h3>
          <div className="segmented">
            {(["B1", "B2"] as const).map((l) => (
              <button key={l} className={level === l ? "is-on" : ""} onClick={() => setLevel(l)} aria-pressed={level === l}>
                {l}
              </button>
            ))}
          </div>
          {listen && (
            <>
              <h3 className="eyebrow">说话方式</h3>
              <div className="segmented">
                <button className={style === "natural" ? "is-on" : ""} onClick={() => (setStyle("natural"), writeKey(STYLE_KEY, "natural"))} aria-pressed={style === "natural"}>
                  接近真人口语
                </button>
                <button className={style === "radio" ? "is-on" : ""} onClick={() => (setStyle("radio"), writeKey(STYLE_KEY, "radio"))} aria-pressed={style === "radio"}>
                  播音稿
                </button>
              </div>
              <p className="muted small">{style === "natural" ? "AI 写稿时加入 euh、ben、省略 ne（c'est pas）、du coup、自我纠正和插话，更像真题里的嘉宾。" : "句子完整、没有停顿词，适合刚开始练。"}</p>
              <h3 className="eyebrow">声音</h3>
              {azure ? (
                <>
                  <div className="segmented segmented-wide">
                    {VOICE_MODES.map(([m, zh]) => (
                      <button key={m} className={voiceMode === m ? "is-on" : ""} onClick={() => (setVoiceMode(m), writeKey(VOICE_KEY, m))} aria-pressed={voiceMode === m}>
                        {zh}
                      </button>
                    ))}
                  </div>
                  <p className="muted small">{voiceMode === "mixed" ? "每段录音随机换声音（支持 3 人以上对话不同音色），约一半用加拿大、比利时或瑞士口音；真题里也会出现非法国口音。" : voiceMode === "france" ? "每段录音随机换一组法国声音（支持 3 人以上不同音色），不总是同几个人。" : "用「我的 → AI 接口」里设置的 Azure 语音作为主声，其余说话人自动分配不同音色。"}</p>
                </>
              ) : (
                <p className="muted">没有设置 Azure 语音，会用这台设备自带的法语语音朗读，音质和语速可能不理想，也换不了口音。</p>
              )}
              <h3 className="eyebrow">环境底噪（可选）</h3>
              <div className="segmented segmented-wide">
                {LISTENING_NOISE.map((n) => (
                  <button key={n.id} className={noise === n.id ? "is-on" : ""} onClick={() => (setNoise(n.id), writeKey(NOISE_KEY, n.id))} aria-pressed={noise === n.id}>
                    {n.label}
                  </button>
                ))}
              </div>
              <p className="muted small">仅在播放录音时以极低音量混入环境底噪（复用系统环境音），帮助适应电台现场或考场扬声器的声场背景。</p>
            </>
          )}
          {listen ? (
            <>
              <h3 className="eyebrow">语速</h3>
              <div className="segmented">
                <button className={!slow ? "is-on" : ""} onClick={() => setSlow(false)} aria-pressed={!slow}>
                  真题语速
                </button>
                <button className={slow ? "is-on" : ""} onClick={() => setSlow(true)} aria-pressed={slow}>
                  慢 15%
                </button>
              </div>
              <p className="muted small">
                {wpm ? `这个声音实测约每分钟 ${wpm} 词，播放速度自动调成 ×${rateFor(wpm, slow).toFixed(2)}。` : "第一次朗读时会测出这个声音的语速，然后自动调到真题的速度。"}
              </p>
            </>
          ) : (
            <>
              <h3 className="eyebrow">限时</h3>
              <div className="segmented">
                <button className={timed ? "is-on" : ""} onClick={() => setTimed(true)} aria-pressed={timed}>
                  {what === "paper" ? READ_MINUTES.paper : what === "opinions" ? READ_MINUTES.opinions : READ_MINUTES.long} 分钟
                </button>
                <button className={!timed ? "is-on" : ""} onClick={() => setTimed(false)} aria-pressed={!timed}>
                  不限时
                </button>
              </div>
            </>
          )}
          {ready.text(ai) ? (
            <div className="writing-actions">
              {making && (
                <p className="muted">
                  AI 出题中：第 {Math.min(made + 1, count)}/{count} 个练习（每个约 20–60 秒）…
                </p>
              )}
              {making ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    ctrl.current?.abort();
                    setPhase("setup");
                  }}
                >
                  取消
                </button>
              ) : (
                <button className="btn btn-primary btn-xl" onClick={() => void make()}>
                  {what === "paper" ? "出一整套" : "出一个练习"} <ArrowRight size={18} />
                </button>
              )}
            </div>
          ) : (
            <p className="muted">
              出新题需要 AI：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务。没有 AI 也可以做下面题库里的预置题。
            </p>
          )}
        </section>
        {listen && (
          <section className="panel">
            <h3 className="eyebrow">真实材料精听</h3>
            <p className="muted">用 RFI、TV5Monde、France Culture 的真人节目：盲听 → 答题 → 逐句听写 → 跟读。应用里只存链接和时间点。</p>
            <button className="btn btn-ghost" onClick={() => setReal(true)}>
              <Headphones size={16} /> 打开真实材料精听
            </button>
          </section>
        )}
        {papers.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">题库（{papers.length} 套，存在这台设备上）</h3>
            <p className="muted small">AI 出过的题都会留下来，可以整套重做，或只重做上次做错的题；不再消耗 AI 额度。「预置」题随应用附带，不用 AI 也能做，内容还未经老师核对。</p>
            <ul className="bank-list">
              {papers.slice(0, 30).map((p) => {
                const last = bank.attempts[p.id]?.[0];
                const wrong = wrongKeys(p, last).length;
                return (
                  <li key={p.id}>
                    <span>
                      {p.src === "preset" ? <span className="chip">预置</span> : day(p.created)} {p.exs.length > 1 ? "整套" : FORM_SPEC[p.exs[0].form].zh} · {paperTopics(p)} · {p.level}
                      {p.style === "natural" ? " · 口语化" : ""}
                      <span className="muted small">{last ? ` · 上次 ${num(last.score)}/${num(last.total)}` : " · 没做过"}</span>
                    </span>
                    <span className="exam-doc-actions">
                      <button className="link" onClick={() => redo(p, false)} disabled={making}>
                        <RotateCcw size={14} /> {last ? "重做" : "做题"}
                      </button>
                      {wrong > 0 && (
                        <button className="link" onClick={() => redo(p, true)} disabled={making}>
                          错题重做（{wrong}）
                        </button>
                      )}
                      {p.src === "ai" && (
                        <>
                          <button className="link" onClick={() => void starPaper(p.id, !p.starred)} aria-pressed={!!p.starred} title={p.starred ? "取消收藏" : "收藏：不会被自动清理"}>
                            <Star size={14} fill={p.starred ? "currentColor" : "none"} />
                          </button>
                          <button className="link" onClick={() => confirm("删除这套题和它的做题记录？") && void deletePaper(p.id)} title="删除">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {stats.length > 0 && (
          <section className="essay-level miss-stats">
            <h3 className="eyebrow">错因统计（最近 {misses.filter((m) => m.part === kind).length} 道错题）</h3>
            {stats.map((x) => (
              <div key={x.cause} className="miss-bar">
                <span>{CAUSE_LABEL[x.cause]}</span>
                <i style={{ width: `${Math.max(4, x.share)}%` }} />
                <span className="muted small">
                  {x.n} 次 · {x.share}%
                </span>
              </div>
            ))}
            <p className="muted small">最常见：{CAUSE_LABEL[stats[0].cause]}。{CAUSE_TIP[stats[0].cause]}</p>
            <div className="miss-actions-list">
              {stats.slice(0, 3).map((x) => (
                <div key={x.cause} className="miss-actions">
                  <span className="muted small">{CAUSE_LABEL[x.cause]} →</span>
                  {missLinksFor(x.cause, kind).map((item) =>
                    item.action === "real" ? (
                      <button key={item.label} type="button" className="chip" onClick={() => setReal(true)}>
                        {item.label}
                      </button>
                    ) : item.route ? (
                      <a key={item.label} className="chip" href={href(item.route)}>
                        {item.label}
                      </a>
                    ) : null,
                  )}
                </div>
              ))}
            </div>
            {bySkill.size > 0 && (
              <p className="muted small">
                按题型的正确率：
                {[...bySkill.entries()].map(([k, v]) => `${QSKILL_LABEL[k]} ${Math.round((v.right / v.n) * 100)}%（${v.n} 题）`).join("，")}
              </p>
            )}
          </section>
        )}
        {log.length > 0 && (
          <section className="essay-level">
            <h3 className="eyebrow">最近的成绩（折合 25 分制）</h3>
            <ul className="essay-history">
              {log.slice(0, 8).map((r, k) => (
                <li key={k}>
                  <span>
                    {day(r.at)} · {r.what === "paper" ? "整套" : (topicOf(r.what)?.zh ?? r.what)}
                  </span>
                  <span className="muted">
                    {num(r.score)}/{num(r.total)} 分{r.total === 25 ? "" : ` · 折合 ${num(outOf25(r))}/25`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const done = phase === "done";

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
            {COMP_LABEL[kind]} · {level} · {exs.length > 1 ? "整套" : topicOf(exs[0]?.topic)?.zh}
            {askedSet ? " · 错题重做" : ""}
          </span>
          {!listen && !done && timed && <span className={`exam-clock ${timer.sec === 0 ? "is-over" : ""}`}>{timer.sec === 0 ? "时间到" : clock(timer.sec)}</span>}
        </header>

        {listen && !done && (
          <p className="muted small">提示：TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。</p>
        )}

        {done && (
          <div className="essay-marks">
            <p className="essay-total">
              {num(score)}
              <small>/{num(total)}</small>
            </p>
            <p className="muted">
              {total === 25 ? "这就是考试的 25 分制。" : `折合考试的 25 分制约 ${num(outOf25({ score, total }))} 分。`}
              及格线是四个部分合计 50/100，每部分不低于 5 分。
            </p>
          </div>
        )}

        {exs.map((ex, e) => {
          if (askedSet && !ex.questions.some((_, k) => askedSet.has(`${e}-${k}`))) return null;
          const spec = FORM_SPEC[ex.form];
          const busy = pace?.e === e;
          const showText = !listen || done;
          return (
            <section key={e} className="exam-exercise">
              <header className="exam-ex-head">
                <h3>
                  {exs.length > 1 ? `EXERCICE ${e + 1}` : "EXERCICE"} <small>{num(exercisePoints(ex))} points</small>
                </h3>
                {ex.intro && (
                  <p className="muted" lang="fr">
                    {ex.intro}
                  </p>
                )}
              </header>

              {listen && !done && (
                <div className="exam-player">
                  {busy ? (
                    <>
                      <span className="exam-clock">
                        {pace.label}
                        {pace.left !== null ? ` ${clock(pace.left)}` : "…"}
                      </span>
                      {pace.left !== null && (
                        <button className="btn btn-ghost" onClick={() => skip.current?.()}>
                          <FastForward size={16} /> 跳过等待
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={halt}>
                        <Square size={16} /> 停止
                      </button>
                    </>
                  ) : heard[e] ? (
                    <span className="muted">这个练习的录音已经放完，凭记忆作答。</span>
                  ) : (
                    <>
                      <button className="btn btn-primary" onClick={() => void perform(e)} disabled={!!pace}>
                        <Play size={16} /> 开始这个练习
                      </button>
                      <span className="muted">
                        {ex.form === "short" ? `三段录音，各读题 ${spec.read} 秒、听一遍、作答 ${spec.answer} 秒。` : `读题 ${spec.read} 秒，听两遍（中间停 ${BETWEEN_PLAYS} 秒），再给 ${spec.answer} 秒作答。`}
                      </span>
                    </>
                  )}
                </div>
              )}

              {showText &&
                ex.docs.map((d, k) => (
                  <article key={k} className="exam-doc">
                    <h4 className="exam-doc-title" lang="fr">
                      {ex.docs.length > 1 ? `Document ${k + 1}` : ex.title}
                    </h4>
                    <p className="essay-text" lang="fr">
                      {d.text}
                    </p>
                    {done && listen && voices[e]?.[k]?.accents.length ? <p className="muted small">口音：{accentNames(voices[e][k].accents)}</p> : null}
                    {done && (
                      <div className="exam-doc-actions">
                        {listen && (
                          <button className="link" onClick={() => setPanel(panel === `i${e}-${k}` ? null : `i${e}-${k}`)}>
                            <Headphones size={14} /> 精听：听写 / 跟读
                          </button>
                        )}
                        <button className="link" onClick={() => setPanel(panel === `w${e}-${k}` ? null : `w${e}-${k}`)}>
                          <ListPlus size={14} /> 原文生词入库
                        </button>
                        {listen &&
                          (busy ? (
                            <button className="link" onClick={halt}>
                              停止
                            </button>
                          ) : (
                            <button className="link" onClick={() => void replay(e, k)}>
                              重听
                            </button>
                          ))}
                        {d.zh && (
                          <button className="link" onClick={() => setShowZh((v) => !v)}>
                            {showZh ? "收起译文" : "看中文译文"}
                          </button>
                        )}
                      </div>
                    )}
                    {done && showZh && d.zh && <p className="essay-text exam-zh">{d.zh}</p>}
                    {done && panel === `w${e}-${k}` && <TranscriptWords text={d.text} deckName={listen ? "听力生词" : "阅读生词"} onClose={() => setPanel(null)} />}
                    {done && panel === `i${e}-${k}` && <IntensiveDoc text={d.text} speak={(t, rate, who) => speakPiece(t, rate, d.text, voices[e]?.[k], who)} />}
                  </article>
                ))}

              {ex.form === "opinions" && (
                <p className="exam-q" lang="fr">
                  À quelle personne associez-vous chaque point de vue ?
                </p>
              )}
              <ol className="exam-questions">
                {ex.questions.map((q, k) => {
                  const key = `${e}-${k}`;
                  if (!isAsked(key)) return null;
                  const miss = done && picked[key] !== q.answer;
                  const first = ex.docs.length > 1 && (k === 0 || ex.questions[k - 1].doc !== q.doc);
                  return (
                    <li key={k}>
                      {first && <p className="eyebrow">Document {q.doc + 1}</p>}
                      <p className="exam-q" lang="fr">
                        {q.q} <small>{num(q.pts)} pt</small>
                      </p>
                      <div className="exam-options" role="radiogroup" aria-label={`第 ${k + 1} 题`}>
                        {q.options.map((o, j) => {
                          const on = picked[key] === j;
                          const state = done ? (j === q.answer ? "is-right" : on ? "is-wrong" : "") : on ? "is-on" : "";
                          return (
                            <button key={j} role="radio" aria-checked={on} className={`exam-option ${state}`} disabled={done} lang="fr" onClick={() => setPicked((p) => ({ ...p, [key]: j }))}>
                              <span>{"ABC"[j]}</span>
                              {o}
                              {done && j === q.answer && <Check size={16} />}
                              {done && on && j !== q.answer && <X size={16} />}
                            </button>
                          );
                        })}
                      </div>
                      {done && q.why && <p className="exam-why">{q.why}</p>}
                      {miss && (
                        <div className="miss-cause" role="group" aria-label="错因">
                          <span className="muted">错因{q.skill ? `（${QSKILL_LABEL[q.skill]}题）` : ""}：</span>
                          {MISS_CAUSES.map((c) => (
                            <button key={c} className={causes[key] === c ? "is-on" : ""} onClick={() => blame(key, c)} aria-pressed={causes[key] === c}>
                              {CAUSE_LABEL[c]}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
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
