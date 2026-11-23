import { ArrowLeft, ArrowRight, Headphones, RotateCcw, Star, Trash2 } from "lucide-react";
import { ACOUSTIC_ENVS, type AcousticEnv } from "../../lib/audio-env";
import {
  COMP_LABEL,
  FORM_SPEC,
  gradeCompQuestion,
  outOf25,
  QSKILL_LABEL,
  READ_MINUTES,
  TOPICS,
  topicOf,
  type CompKind,
} from "../../lib/exam";
import { PRESET_PAPERS } from "../../lib/exam-presets";
import { EXAM_TRACKS, TRACK_META, type ExamTrack } from "../../lib/exam-tracks";
import { CAUSE_LABEL, CAUSE_TIP, missStats, skillStats, type CompMiss, type VoiceMode } from "../../lib/listening";
import { missLinksFor } from "../../lib/miss-links";
import { go, href } from "../../lib/router";
import { LISTENING_NOISE, type ListeningNoiseId } from "../../lib/sound";
import type { TrackPaper } from "../../lib/tcf-tef-presets";
import { deletePaper, starPaper, wrongKeys, type Attempt, type BankPaper } from "../../store/exam-bank";
import { type ExamResult } from "../../lib/exam-schema";
import { confirmAction } from "../../ui/ConfirmSheet";
import { normalizeCompQuestionForKind, shouldShowCompFormatPicker, type CompQFormat } from "../comprehension-helpers";
import {
  CONTINUOUS_KEY,
  day,
  NOISE_KEY,
  num,
  paperTopics,
  rateFor,
  STYLE_KEY,
  VOICE_KEY,
  VOICE_MODES,
  writeKey,
  type What,
} from "./helpers";

export interface CompSetupProps {
  kind: CompKind;
  examTrack: ExamTrack;
  onSelectTrack: (t: ExamTrack) => void;
  listen: boolean;
  azure: boolean;
  canAiText: boolean;
  making: boolean;
  made: number;
  count: number;
  forms: What[];
  what: What;
  setWhat: (w: What) => void;
  topic: string;
  setTopic: (t: string) => void;
  qFormat: CompQFormat;
  setQFormat: (f: CompQFormat) => void;
  level: "B1" | "B2";
  setLevel: (l: "B1" | "B2") => void;
  style: "radio" | "natural";
  setStyle: (s: "radio" | "natural") => void;
  voiceMode: VoiceMode;
  setVoiceMode: (m: VoiceMode) => void;
  noise: ListeningNoiseId;
  setNoise: (n: ListeningNoiseId) => void;
  acousticEnv: AcousticEnv;
  setAcousticEnv: (env: AcousticEnv) => void;
  slow: boolean;
  setSlow: (s: boolean) => void;
  wpm: number;
  continuousMock: boolean;
  setContinuousMock: (v: boolean) => void;
  timed: boolean;
  setTimed: (v: boolean) => void;
  strictLock: boolean;
  setStrictLock: (v: boolean) => void;
  bankPapers: BankPaper[];
  trackPapers: TrackPaper[];
  onDeleteTrackPaper: (id: string) => void;
  bankAttempts: Record<string, Attempt[]>;
  misses: CompMiss[];
  log: ExamResult[];
  onExit: () => void;
  onOpenReal: () => void;
  onCancelMake: () => void;
  onMake: () => void;
  onRedo: (p: BankPaper | TrackPaper, wrongOnly: boolean) => void;
}

export function CompSetupView({
  kind,
  examTrack,
  onSelectTrack,
  listen,
  azure,
  canAiText,
  making,
  made,
  count,
  forms,
  what,
  setWhat,
  topic,
  setTopic,
  qFormat,
  setQFormat,
  level,
  setLevel,
  style,
  setStyle,
  voiceMode,
  setVoiceMode,
  noise,
  setNoise,
  acousticEnv,
  setAcousticEnv,
  slow,
  setSlow,
  wpm,
  continuousMock,
  setContinuousMock,
  timed,
  setTimed,
  strictLock,
  setStrictLock,
  bankPapers,
  trackPapers,
  onDeleteTrackPaper,
  bankAttempts,
  misses,
  log,
  onExit,
  onOpenReal,
  onCancelMake,
  onMake,
  onRedo,
}: CompSetupProps) {
  const isDelf = examTrack === "delf";
  const trackMeta = TRACK_META[examTrack];
  const papers = [...PRESET_PAPERS, ...bankPapers].filter((p) => p.kind === kind);
  const stats = missStats(misses, kind);
  // right / asked by kind of question, over the last attempt at every paper of the bank
  const bySkill = skillStats(
    papers.flatMap((p) => {
      const a = bankAttempts[p.id]?.find((x) => !x.asked);
      return a
        ? p.exs.flatMap((ex, e) =>
            ex.questions.map((q, k) => ({
              skill: q.skill,
              right: gradeCompQuestion(normalizeCompQuestionForKind(q, kind), a.picked[`${e}-${k}`], a.typed?.[`${e}-${k}`], ex.docs[q.doc]?.text).correct,
            })),
          )
        : [];
    }),
  );

  return (
    <div className="page practice">
      <header className="page-head">
        <button className="link deck-back" onClick={onExit}>
          <ArrowLeft size={16} /> 返回练习
        </button>
        {!listen && (
          <div className="segmented gram-tabs" role="tablist" aria-label="阅读训练模式">
            <a role="tab" aria-selected={false} href="#/read">
              报刊精读（免 AI）
            </a>
            <a role="tab" aria-selected={true} className="is-on" href="#/examread">
              CE 应试阅读
            </a>
          </div>
        )}
        <p className="eyebrow">
          {trackMeta.shortName} · {COMP_LABEL[kind]} · {listen ? "Compréhension de l'oral" : "Compréhension des écrits"}
        </p>
        <h1 className="display">{listen ? "只听，不看。" : "读得快，也读得准。"}</h1>
        <p className="lede">
          {isDelf
            ? listen
              ? "和考试一样：一套三个练习共 25 分。两段长录音各听两遍，三段短录音各听一遍；每题三个选项，按难度占 0.5 至 2.5 分不等。先读题，再听，按考试的停顿时间作答。"
              : "和考试一样：一套三个练习共 25 分，限时 1 小时。两篇报刊文章各 7 题，再加一组「这是谁的观点」；每题三个选项，按难度占 0.5 至 2.5 分不等。"
            : examTrack === "tcf"
              ? listen
                ? "严格对照 TCF 官方考规：全程四选一（A/B/C/D），每段录音严格「1 遍播音」（先给 20 秒读题预览，播音 1 遍后 15 秒作答），按 A2→C1 难度权重换算 100–699 分与加拿大移民 NCLC 等级。"
                : "严格对照 TCF 官方考规：从日常应用通知到 C1 学术/社论综合长文阶梯递进，四选一（A/B/C/D），交卷即换算 100–699 分、CEFR 与 NCLC 等级。"
              : listen
                ? "严格对照 TEF 2023.12 新政：覆盖电话留言、公共广播、街头微访谈与深度电台专访四大语体，全程四选一（A/B/C/D）且「严格 1 遍播音」，换算 0–699 分与 NCLC 等级。"
                : "严格对照 TEF 2023.12 新政五节全题型：日常实用文档、篇章填句、多源快速寻读、报刊深度阅读与词汇句法同义改写，全程四选一（A/B/C/D），换算 0–699 分与 NCLC 等级。"}
        </p>
        {listen && (
          <div className="exam-notice" role="note">
            <p>
              <b>TTS 音频仅用于熟悉题型，考前须搭配真实电台脱敏。</b>
              <span className="muted small">真实法语考试录音带现场底噪、电话窄带滤波、语流吞连与 ~170 WPM 快语速。考前请务必结合「真实材料精听」（含 6 期 RFI + 4 篇 ~170 WPM 常速广播专题）脱敏。</span>
            </p>
            <button className="btn btn-ghost" onClick={onOpenReal}>
              <Headphones size={15} /> 去听真实电台与常速专题
            </button>
          </div>
        )}
      </header>
      <section className="panel exam-setup">
        <h3 className="eyebrow">目标考试赛道</h3>
        <div className="segmented segmented-wide" role="tablist" aria-label="考试赛道切换">
          {EXAM_TRACKS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={examTrack === t}
              className={examTrack === t ? "is-on" : ""}
              onClick={() => onSelectTrack(t)}
            >
              {TRACK_META[t].shortName}
            </button>
          ))}
        </div>
        <p className="muted small">
          {trackMeta.scaleSummary} · 目标参考：{trackMeta.b2TargetLabel}
        </p>

        {isDelf && (
          <>
            <h3 className="eyebrow">练什么</h3>
            <div className="segmented segmented-wide">
              {forms.map((f) => (
                <button key={f} className={what === f ? "is-on" : ""} onClick={() => setWhat(f)} aria-pressed={what === f}>
                  {f === "paper" ? "整套（25 分）" : FORM_SPEC[f].zh}
                </button>
              ))}
            </div>
          </>
        )}
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
        {isDelf && what === "paper" && topic !== "random" && <p className="muted small">整套题的第一个练习用所选话题，后两个换别的话题。</p>}
        {isDelf && shouldShowCompFormatPicker(kind, what) && (
          <>
            <h3 className="eyebrow">题目格式</h3>
            <div className="segmented">
              <button className={qFormat === "qcm" ? "is-on" : ""} onClick={() => setQFormat("qcm")} aria-pressed={qFormat === "qcm"}>
                纯三选一 QCM（2020 新版考纲）
              </button>
              <button className={qFormat === "parallel" ? "is-on" : ""} onClick={() => setQFormat("parallel")} aria-pressed={qFormat === "parallel"}>
                旧版考纲附加训练（含引证与简答）
              </button>
            </div>
          </>
        )}
        {isDelf && (
          <>
            <h3 className="eyebrow">难度</h3>
            <div className="segmented">
              {(["B1", "B2"] as const).map((l) => (
                <button key={l} className={level === l ? "is-on" : ""} onClick={() => setLevel(l)} aria-pressed={level === l}>
                  {l}
                </button>
              ))}
            </div>
          </>
        )}
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
            <h3 className="eyebrow">声学环境滤波（考场 / 电台 / 电话 / 街头）</h3>
            <div className="segmented segmented-wide" role="group" aria-label="声学环境预设">
              {ACOUSTIC_ENVS.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  className={acousticEnv === env.id ? "is-on" : ""}
                  onClick={() => setAcousticEnv(env.id)}
                  aria-pressed={acousticEnv === env.id}
                >
                  {env.label}
                </button>
              ))}
            </div>
            <p className="muted small">
              {ACOUSTIC_ENVS.find((env) => env.id === acousticEnv)?.desc}（TCF / TEF 电话留言题建议开启「电话滤波」提前脱敏）。
            </p>
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
            <h3 className="eyebrow">整卷播放模式</h3>
            <div className="segmented">
              <button
                className={continuousMock ? "is-on" : ""}
                onClick={() => {
                  setContinuousMock(true);
                  writeKey(CONTINUOUS_KEY, "1");
                }}
                aria-pressed={continuousMock}
              >
                连续不可中断（模考真实节奏）
              </button>
              <button
                className={!continuousMock ? "is-on" : ""}
                onClick={() => {
                  setContinuousMock(false);
                  writeKey(CONTINUOUS_KEY, "0");
                }}
                aria-pressed={!continuousMock}
              >
                逐题手动触发（可暂停/跳过）
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="eyebrow">限时</h3>
            <div className="segmented">
              <button className={timed ? "is-on" : ""} onClick={() => setTimed(true)} aria-pressed={timed}>
                {isDelf
                  ? what === "paper"
                    ? READ_MINUTES.paper
                    : what === "opinions"
                      ? READ_MINUTES.opinions
                      : READ_MINUTES.long
                  : examTrack === "tcf"
                    ? 25
                    : 30}{" "}
                分钟
              </button>
              <button className={!timed ? "is-on" : ""} onClick={() => setTimed(false)} aria-pressed={!timed}>
                不限时
              </button>
            </div>
            {timed && (
              <div className="segmented mt-xs">
                <button className={strictLock ? "is-on" : ""} onClick={() => setStrictLock(true)} aria-pressed={strictLock}>
                  模考严格到时锁卷交卷
                </button>
                <button className={!strictLock ? "is-on" : ""} onClick={() => setStrictLock(false)} aria-pressed={!strictLock}>
                  仅计时提醒
                </button>
              </div>
            )}
          </>
        )}
        {canAiText ? (
          <div className="writing-actions">
            {making && (
              <p className="muted">
                AI 出题中：第 {Math.min(made + 1, count)}/{count} 个练习（每个约 20–60 秒）…
              </p>
            )}
            {making ? (
              <button className="btn btn-ghost" onClick={onCancelMake}>
                取消
              </button>
            ) : (
              <button className="btn btn-primary btn-xl" onClick={onMake}>
                {isDelf ? (what === "paper" ? "出一整套" : "出一个练习") : `AI 生成 ${trackMeta.shortName} 四选一（6 题）`} <ArrowRight size={18} />
              </button>
            )}
          </div>
        ) : (
          <p className="muted">
            出新题需要 AI：先到 <a className="link" href={href({ page: "me" })}>我的 → AI 接口</a> 设置 AI 文本服务。没有 AI 也可以做下面题库里的预置题。
          </p>
        )}
      </section>
      {listen && (
        <section className="panel">
          <h3 className="eyebrow">真实材料精听</h3>
          <p className="muted">用 RFI、TV5Monde、France Culture 的真人节目：盲听 → 答题 → 逐句听写 → 跟读。应用里只存链接和时间点。</p>
          <button className="btn btn-ghost" onClick={onOpenReal}>
            <Headphones size={16} /> 打开真实材料精听
          </button>
        </section>
      )}
      {!isDelf && (
        <section className="essay-level">
          <h3 className="eyebrow">
            {trackMeta.shortName} 精编四选一题库（{trackPapers.length} 套 · 免 AI 开箱即测）
          </h3>
          <p className="muted small">
            内置完整 A/B/C/D 四选一进阶套卷（{listen ? "严格 1 遍播音 + 20s 读题倒计时" : "含完整原文寻证与四项干扰陷阱批注"}），交卷即算 699 分制与加拿大移民 NCLC 等级（内容待核对）。
          </p>
          {trackPapers.length === 0 ? (
            <p className="muted small">正在加载题库…</p>
          ) : (
            <ul className="bank-list">
              {trackPapers.map((tp) => {
                const last = bankAttempts[tp.id]?.[0];
                const wrong = wrongKeys(tp as unknown as BankPaper, last).length;
                const totalQs = tp.exs.reduce((n, ex) => n + ex.questions.length, 0);
                return (
                  <li key={tp.id}>
                    <span>
                      <span className="chip">{tp.src === "preset" ? "预置" : "AI"}</span>{" "}
                      <b>{tp.titleZh}</b> · {totalQs} 题 · {tp.badge}
                      <span className="muted small">
                        {last ? ` · 上次答对 ${num(last.score)}/${num(last.total)}` : " · 没做过"}
                      </span>
                    </span>
                    <span className="exam-doc-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => onRedo(tp, false)} disabled={making}>
                        <RotateCcw size={14} /> {last ? "重测" : "开始套卷"}
                      </button>
                      {wrong > 0 && (
                        <button className="link" onClick={() => onRedo(tp, true)} disabled={making}>
                          错题重做（{wrong}）
                        </button>
                      )}
                      {tp.src === "ai" && (
                        <button
                          className="link"
                          onClick={() => onDeleteTrackPaper(tp.id)}
                          title="删除"
                          aria-label="删除这套题"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {isDelf && papers.length > 0 && (
        <section className="essay-level">
          <h3 className="eyebrow">题库（{papers.length} 套，存在这台设备上）</h3>
          <p className="muted small">
            AI 出过的题都会留下来，可以整套重做，或只重做上次做错的题；不再消耗 AI 额度。「预置」题包含完整 25 分套卷（每套均达 B2 官方篇幅），不用 AI 也能完整模考，内容还未经老师核对。考前建议同步对照{" "}
            <a className="link" href="https://www.france-education-international.fr/diplome/delf-tout-public/niveau-b2/exemples-sujets" target="_blank" rel="noreferrer">
              FEI 官方免费 DELF B2 样题
            </a>{" "}
            校准难度。
          </p>
          <ul className="bank-list">
            {papers.slice(0, 30).map((p) => {
              const last = bankAttempts[p.id]?.[0];
              const wrong = wrongKeys(p, last).length;
              return (
                <li key={p.id}>
                  <span>
                    {p.src === "preset" ? <span className="chip">预置</span> : day(p.created)} {p.exs.length > 1 ? "整套" : FORM_SPEC[p.exs[0].form].zh} · {paperTopics(p)} · {p.level}
                    {p.style === "natural" ? " · 口语化" : ""}
                    <span className="muted small">{last ? ` · 上次 ${num(last.score)}/${num(last.total)}` : " · 没做过"}</span>
                  </span>
                  <span className="exam-doc-actions">
                    <button className="link" onClick={() => onRedo(p, false)} disabled={making}>
                      <RotateCcw size={14} /> {last ? "重做" : "做题"}
                    </button>
                    {wrong > 0 && (
                      <button className="link" onClick={() => onRedo(p, true)} disabled={making}>
                        错题重做（{wrong}）
                      </button>
                    )}
                    {p.src === "ai" && (
                      <>
                        <button className="link" onClick={() => void starPaper(p.id, !p.starred)} aria-pressed={!!p.starred} title={p.starred ? "取消收藏" : "收藏：不会被自动清理"}>
                          <Star size={14} fill={p.starred ? "currentColor" : "none"} />
                        </button>
                        <button
                          className="link"
                          onClick={async () => {
                            if (
                              await confirmAction({
                                title: "删除这套题和它的做题记录？",
                                message: "此操作不可撤销。",
                                confirmLabel: "删除",
                                danger: true,
                              })
                            ) {
                              void deletePaper(p.id);
                            }
                          }}
                          title="删除"
                          aria-label="删除这套题"
                        >
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
          <div className="panel-head">
            <h3 className="eyebrow">错因统计（最近 {misses.filter((m) => m.part === kind).length} 道错题）</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ page: "reflow" })}>
              进入 FSRS 错题回炉 <ArrowRight size={14} />
            </button>
          </div>
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
                    <button key={item.label} type="button" className="chip" onClick={onOpenReal}>
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
          <h3 className="eyebrow">
            {isDelf ? "最近的成绩（折合 25 分制）" : `最近的 ${trackMeta.shortName} 成绩（699 分制 & NCLC）`}
          </h3>
          <ul className="essay-history">
            {log.slice(0, 8).map((r, k) => (
              <li key={k}>
                <span>
                  {day(r.at)} · {r.what === "paper" ? "整套" : (topicOf(r.what)?.zh ?? r.what)}
                </span>
                <span className="muted">
                  {typeof r.scaledScore === "number"
                    ? `${r.scaledScore}/699${r.nclc ? ` · NCLC ${r.nclc}` : ""}（${num(r.score)}/${num(r.total)} 题）`
                    : `${num(r.score)}/${num(r.total)} 分${r.total === 25 ? "" : ` · 折合 ${num(outOf25(r))}/25`}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
