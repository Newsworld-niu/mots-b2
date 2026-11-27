import { ArrowRight, Calendar, Compass, GraduationCap, Sprout, Target } from "lucide-react";
import { useState } from "react";
import { useAtlas } from "../atlas/context";
import { PLACEMENT_ESTIMATE, SECTION_META, type PlacementResult } from "../lib/placement";
import { addMonthsDate, daysUntilExam } from "../lib/study-plan";
import { MAX_DAILY_NEW, store, type Settings } from "../store/store";
import { CountPicker } from "../ui/CountPicker";
import { PlacementTest } from "../ui/PlacementTest";

// Start bands match the source books (Débutant A1, A2–B1, B2/DELF). The path inside a band is by frequency.
const LEVELS = [
  ["A1", "入门", "从最常用的词开始"],
  ["A2", "基础", "会一些日常表达"],
  ["B1", "进阶", "能读懂简单文章"],
  ["B2", "中高", "备考 DELF B2"],
];

type Goal = NonNullable<Settings["goal"]>;
type Track = Settings["examTrack"];

const GOALS: { id: Goal; title: string; desc: string; icon: typeof Sprout }[] = [
  { id: "everyday", title: "日常进阶（A1–B2 循序渐进）", desc: "每天一份轻松清单：词汇、语法、听说微读，不设倒计时。", icon: Sprout },
  { id: "exam", title: "备考冲刺（DELF B2 / TCF / TEF）", desc: "按考期分配听说读写，盯紧分数线与模考。", icon: GraduationCap },
];

const TRACKS: { id: Track; name: string; hint: string }[] = [
  { id: "delf", name: "DELF B2", hint: "四项各 25 分，总分 ≥50 且单项 ≥5" },
  { id: "tcf", name: "TCF / TCF Canada", hint: "听读 100–699（CEFR B2 400+）· 写说 0–20（B2 10+）" },
  { id: "tef", name: "TEF / TEF Canada", hint: "2023.12 新政，各科 0–699" },
];

export function Onboarding() {
  const atlas = useAtlas();
  const [mode, setMode] = useState<Goal>(() => store.get().settings.goal ?? "everyday");
  const [track, setTrack] = useState<Track>(() => store.get().settings.examTrack);
  const [level, setLevel] = useState(0);
  const [goal, setGoal] = useState(10);
  const [examDate, setExamDate] = useState<string>("");
  const [targetScore, setTargetScore] = useState(75);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [placement, setPlacement] = useState<PlacementResult | null>(null);

  const exam = mode === "exam";
  const daysLeft = exam ? daysUntilExam(examDate || null) : null;
  const underSixMonths = daysLeft !== null && daysLeft < 183;

  const finish = () => {
    if (placement) store.progress((p) => ({ ...p, placement }));
    store.settings({
      onboarded: true,
      goal: mode,
      startLevel: atlas.cefr.indexOf(LEVELS[level][0]),
      dailyNew: goal,
      // 日常进阶 keeps no exam countdown; the exam fields can be set later from the home page or 我的.
      ...(exam
        ? {
            examTrack: track,
            examDate: examDate || null,
            targetScore: Math.max(50, Math.min(100, Math.round(targetScore || 75))),
            dailyMinutes,
          }
        : { examDate: null }),
    });
  };

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="欢迎">
      <div className={`onboard-card ${testing ? "is-wide" : ""}`}>
        {!testing && <img className="onboard-art" src={`${import.meta.env.BASE_URL}brand/hero.webp`} alt="" />}
        <div className="onboard-body">
          {testing ? (
            <PlacementTest
              initial={placement ?? undefined}
              onCancel={() => setTesting(false)}
              onApply={(res) => {
                setPlacement(res);
                setLevel(Math.max(0, Math.min(LEVELS.length - 1, res.level)));
                setTesting(false);
              }}
            />
          ) : (
            <>
              <p className="eyebrow">欢迎来到法语词光</p>
              <h1 className="display">
                {atlas.count.toLocaleString()} 颗星，
                <br />
                等你一颗颗点亮。
              </h1>
              <fieldset className="onboard-mode">
                <legend>学习模式</legend>
                <div className="onboard-mode-grid" role="group" aria-label="学习模式">
                  {GOALS.map(({ id, title, desc, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={mode === id}
                      className={`choice onboard-mode-choice ${mode === id ? "is-on" : ""}`}
                      onClick={() => setMode(id)}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <b>{title}</b>
                      <small>{desc}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>你从哪里出发？</legend>
                <div className="choice-grid">
                  {LEVELS.map(([code, name, desc], i) => (
                    <button key={code} type="button" className={`choice ${level === i ? "is-on" : ""}`} onClick={() => setLevel(i)} aria-pressed={level === i}>
                      <span className={`chip chip-level lv-${code}`}>{code}</span>
                      <b>{name}</b>
                      <small>{desc}</small>
                    </button>
                  ))}
                </div>
                <div className="onboard-diag">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTesting(true)}>
                    <Compass size={15} /> {placement ? "重做摸底定级小测" : `不确定？做摸底定级小测（${PLACEMENT_ESTIMATE}）`}
                  </button>
                  {placement && (
                    <span className="muted small">
                      已评估：<b>{LEVELS[placement.level]?.[0]}</b>（{placement.score}分）
                      {placement.weak.length ? ` · 建议补强${placement.weak.map((k) => SECTION_META[k].label).join("、")}` : ""}
                    </span>
                  )}
                </div>
              </fieldset>

              {exam && (
                <fieldset className="onboard-exam">
                  <legend>备考目标</legend>
                  <div className="onboard-field" role="group" aria-label="目标考试">
                    <span>目标考试</span>
                    <div className="segmented onboard-tracks">
                      {TRACKS.map((t) => (
                        <button key={t.id} type="button" className={track === t.id ? "is-on" : ""} onClick={() => setTrack(t.id)} aria-pressed={track === t.id} title={t.hint}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="muted small">{TRACKS.find((t) => t.id === track)?.hint}。考试日期与目标分都可以先不填。</p>
                  <div className="onboard-exam-row">
                    <label className="onboard-field">
                      <span>
                        <Calendar size={14} /> 考试日期
                      </span>
                      <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} aria-label="考试日期" />
                    </label>
                    <div className="onboard-presets">
                      <button type="button" className={`chip-btn ${examDate === addMonthsDate(3) ? "is-on" : ""}`} onClick={() => setExamDate(addMonthsDate(3))}>
                        3 个月后
                      </button>
                      <button type="button" className={`chip-btn ${examDate === addMonthsDate(6) ? "is-on" : ""}`} onClick={() => setExamDate(addMonthsDate(6))}>
                        6 个月后
                      </button>
                      {examDate && (
                        <button type="button" className="link small" onClick={() => setExamDate("")}>
                          暂不设定
                        </button>
                      )}
                    </div>
                  </div>
                  {daysLeft !== null && (
                    <p className="muted small">
                      {daysLeft > 0 ? `距离考试约 ${daysLeft} 天。` : daysLeft === 0 ? "就在今天。" : "已过设定考期，可随时调整。"}
                      {underSixMonths && " 不足 6 个月：首页将为你分配听说读写任务，并将背词控制在 ≤25% 时间。"}
                    </p>
                  )}
                  <div className="onboard-exam-row">
                    {track === "delf" && (
                      <div className="onboard-field" role="group" aria-label="目标总分（/100）">
                        <span>
                          <Target size={14} /> 目标总分（/100）
                        </span>
                        <div className="segmented">
                          {[60, 75, 85].map((sc) => (
                            <button key={sc} type="button" className={targetScore === sc ? "is-on" : ""} onClick={() => setTargetScore(sc)} aria-pressed={targetScore === sc}>
                              {sc} 分
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="onboard-field" role="group" aria-label="每日备考预算时长">
                      <span>每日备考时长</span>
                      <div className="segmented">
                        {([null, 30, 45, 60, 90] as const).map((m) => (
                          <button key={m ?? "auto"} type="button" className={dailyMinutes === m ? "is-on" : ""} onClick={() => setDailyMinutes(m)} aria-pressed={dailyMinutes === m}>
                            {m === null ? "自动" : `${m}分`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </fieldset>
              )}

              <fieldset>
                <legend>每天点亮几颗新星？</legend>
                <CountPicker label="每天的新词数" value={goal} onChange={setGoal} presets={[5, 10, 20, 50]} max={MAX_DAILY_NEW} unit=" 颗" />
                <p className="muted small">
                  {underSixMonths && goal > 10
                    ? "冲刺期建议每天 5–10 颗新词，把 75% 以上时间留给听说读写与真题模考。"
                    : "推荐 10 颗；想学多少都可以，之后在「我的」里随时改。"}
                </p>
              </fieldset>
              <button className="btn btn-primary btn-xl" onClick={finish}>
                出发 <ArrowRight size={20} />
              </button>
              <p className="muted">不用注册。进度只留在这台设备上；学习模式在首页一键切换，其余设置随时可在「我的」里修改。</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
