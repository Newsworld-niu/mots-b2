import { AlertTriangle, ArrowRight, Award, Clock, PlayCircle } from "lucide-react";
import { EXAM_PARTS, examReadiness, outOf25, PART_LABEL, type ExamPart } from "../lib/exam-schema";
import { EXAM_TRACKS, TRACK_META, trackReadiness, type ExamTrack, type TrackSection } from "../lib/exam-tracks";
import { href, type Route } from "../lib/router";
import { store, useStore } from "../store/store";
import "../styles/listening.css";

const num = (n: number) => String(n);
const DAY_MS = 86_400_000;
const RECENCY_WINDOW_DAYS = 30;

function formatAgeLabel(at: number | null, now: number): { text: string; stale: boolean } {
  if (at === null) return { text: "待实测", stale: false };
  const days = Math.max(0, Math.floor((now - at) / DAY_MS));
  if (days > RECENCY_WINDOW_DAYS) {
    return { text: `${days} 天前（超 30 天建议重测）`, stale: true };
  }
  return { text: days === 0 ? "今日已核验" : `${days} 天前（30 天内有效）`, stale: false };
}

function sectionJumpRoute(section: TrackSection, track: "tcf" | "tef"): Route {
  if (section === "co") return { page: "listen" };
  if (section === "struct") return { page: "grammar", sprint: track };
  if (section === "ce") return { page: "examread" };
  if (section === "ee") return { page: "essay" };
  return { page: "speak" };
}

function sectionJumpLabel(section: TrackSection): string {
  if (section === "co") return "练听力";
  if (section === "struct") return "练结构";
  if (section === "ce") return "练阅读";
  if (section === "ee") return "练写作";
  return "练口语";
}

function TrackPillToggle({ examTrack }: { examTrack: ExamTrack }) {
  return (
    <div className="segmented" role="tablist" aria-label="考试体系切换">
      {EXAM_TRACKS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={examTrack === t}
          className={examTrack === t ? "is-on" : ""}
          onClick={() => store.settings({ examTrack: t })}
        >
          {TRACK_META[t].shortName}
        </button>
      ))}
    </div>
  );
}

/**
 * 多轨法语考试冲刺仪表盘（DELF B2 / TCF / TEF）：
 * - DELF B2：严格分离「已核验实测（客观整卷 + AI 批改 PE + 全程语音 AI+发音 PO）」与「未核验自评 / 定级摸底估算」，展示 /100 与 <5/25 淘汰红线预警。
 * - TCF / TEF：展示五大官方科目（CO · Structure · CE · EE · EO）的 100–699 / 0–20 / 0–699 分数、CEFR 等级与加拿大移民 NCLC 7+ 达标标识。
 */
export function ExamDashboard({ onStartMock, compact = false }: { onStartMock?: () => void; compact?: boolean }) {
  const examLog = useStore((s) => s.progress.examLog);
  const placement = useStore((s) => s.progress.placement);
  const examTrack: ExamTrack = useStore((s) => s.settings.examTrack) ?? "delf";
  const settings = useStore((s) => s.settings) as { targetScore?: number };
  const target = typeof settings.targetScore === "number" && settings.targetScore >= 50 ? settings.targetScore : 75;
  const now = Date.now();

  if (examTrack === "tcf" || examTrack === "tef") {
    const tr = trackReadiness(examLog, examTrack);
    const meta = TRACK_META[examTrack];
    return (
      <section className={`panel exam-dashboard ${compact ? "is-compact" : ""}`} aria-label={`${meta.shortName} 五科实测与 NCLC 概览`}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">{meta.name} · 五科分项与 NCLC 追踪</p>
            <h2 className="exam-dash-title">
              {tr.completedCount > 0 ? (
                <>
                  <span className="exam-dash-val">
                    <b>{tr.completedCount}</b>
                    <small>/{tr.totalSections} 科已测</small>
                  </span>
                  <small className="exam-dash-note">
                    （{tr.minNclc !== null ? `当前木桶短板 NCLC ${tr.minNclc}` : "按分项独立定级"} · {meta.b2TargetLabel}）
                  </small>
                </>
              ) : (
                <span>尚未完成 {meta.shortName} 分科实测</span>
              )}
            </h2>
          </div>
          <div className="exam-dash-badges">
            <TrackPillToggle examTrack={examTrack} />
            {tr.allNclc7Met === true && (
              <span className="chip is-pass">
                <Award size={13} /> 四项核心全达 NCLC 7+（加拿大移民线）
              </span>
            )}
            {tr.allNclc7Met !== true && tr.allB2Met === true && (
              <span className="chip is-pass">核心四科均达 B2</span>
            )}
            <span className="chip">{meta.badge}</span>
          </div>
        </div>

        <p className="muted small">{meta.scaleSummary}</p>

        <div className="exam-four-grid">
          {tr.sections.map((sec) => {
            const recency = formatAgeLabel(sec.at, now);
            const jumpHref = href(sectionJumpRoute(sec.section, examTrack));
            return (
              <div
                key={sec.section}
                className={`exam-four-cell ${sec.nclc7Met ? "is-strong" : ""} ${recency.stale ? "is-stale" : ""}`}
              >
                <span className="eyebrow">{sec.label}</span>
                <strong className="exam-four-score">
                  {sec.displayScore ? (
                    sec.displayScore
                  ) : (
                    <small className="muted">
                      待实测（/{sec.scaleMax}）
                    </small>
                  )}
                </strong>
                {sec.rawNumeric !== null ? (
                  <div className="exam-dash-badges">
                    {sec.cefr && (
                      <span className={`chip ${sec.b2Met ? "is-pass" : ""}`}>{sec.cefr}</span>
                    )}
                    {sec.nclc !== null && (
                      <span
                        className={`chip ${sec.nclc7Met ? "is-pass" : ""}`}
                        title={sec.nclc7Met ? "已达加拿大联邦/魁省常见法语加分门槛 NCLC 7+" : "距离 NCLC 7 仍有提升空间"}
                      >
                        NCLC {sec.nclc}{sec.nclc >= 7 ? "+" : ""}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="muted small">单科独立计分 · 支持直接开练</span>
                )}
                <div className="exam-doc-actions">
                  <span className="muted small">{recency.text}</span>
                  <a className="btn btn-ghost btn-sm" href={jumpHref}>
                    {sec.rawNumeric !== null ? "重测" : sectionJumpLabel(sec.section)} <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="exam-dash-foot">
          <p className="muted small">
            冲刺参考：{meta.b2TargetLabel}。点击任一分科右侧按钮即可直达对应单遍听力、四选一阅读、语法结构冲刺或写作/口语考场。
          </p>
          {onStartMock && (
            <button className="btn btn-primary" onClick={onStartMock}>
              <PlayCircle size={16} /> 进入全真连堂模考 <ArrowRight size={15} />
            </button>
          )}
        </div>
      </section>
    );
  }

  const r = examReadiness(examLog, target);

  const scoredParts = r.parts.filter((p) => p.score25 !== null);
  const staleParts = scoredParts.filter((p) => p.at !== null && now - p.at > RECENCY_WINDOW_DAYS * DAY_MS);
  // Verified confidence band: ±3.5 pts when all 4 parts are fresh (<=30d), widening by +1.0 pt per stale (>30d) part.
  const confidenceBand100 =
    r.exact100 !== null ? Math.round((3.5 + staleParts.length * 1.0) * 10) / 10 : null;
  const partialBand =
    r.exact100 === null && r.completed > 0
      ? Math.round((r.completed * 1.0 + staleParts.length * 0.5) * 10) / 10
      : null;

  const unverifiedItems: { part: ExamPart; label: string; score25: number; source: string; stale: boolean }[] = [];
  for (const part of EXAM_PARTS) {
    const unv = r.unverifiedLatest?.[part];
    if (unv) {
      const isPlacement = unv.what.startsWith("placement-");
      unverifiedItems.push({
        part,
        label: PART_LABEL[part],
        score25: outOf25(unv),
        source: isPlacement ? "定级摸底" : "离线自评",
        stale: now - unv.at > RECENCY_WINDOW_DAYS * DAY_MS,
      });
      continue;
    }
    if (placement) {
      const pctVal =
        part === "listen"
          ? placement.sections.listen
          : part === "read"
            ? placement.sections.read
            : part === "essay" && placement.production
              ? placement.production.score
              : null;
      if (pctVal !== null && pctVal !== undefined) {
        unverifiedItems.push({
          part,
          label: PART_LABEL[part],
          score25: Math.round((pctVal / 100) * 250) / 10,
          source: "定级摸底",
          stale: now - placement.at > RECENCY_WINDOW_DAYS * DAY_MS,
        });
      }
    }
  }

  return (
    <section className={`panel exam-dashboard ${compact ? "is-compact" : ""}`} aria-label="DELF B2 四项总分与底线预警">
      <div className="panel-head">
        <div>
          <p className="eyebrow">DELF B2 已核验实测总览（AI 批改 + 全程语音）</p>
          <h2 className="exam-dash-title">
            {r.exact100 !== null ? (
              <>
                <span className="exam-dash-val">
                  <b>{num(r.exact100)}</b>
                  <small>/100</small>
                </span>
                <small className="exam-dash-note">
                  （±{num(confidenceBand100!)} 分 · {staleParts.length === 0 ? "30 天内四科已核验" : `${staleParts.length} 科超 30 天待重测`}）
                </small>
              </>
            ) : r.completed > 0 ? (
              <>
                <span className="exam-dash-val">
                  <b>{num(r.scoredSum)}</b>
                  <small>/{r.scoredMax}</small>
                </span>
                <small className="exam-dash-note">
                  （已核验 {r.completed}/4 科 · ±{num(partialBand!)} 分 · 凑齐 4 科后计 /100）
                </small>
              </>
            ) : (
              <span>尚未完成已核验 DELF B2 整科实测</span>
            )}
          </h2>
        </div>
        <div className="exam-dash-badges">
          <TrackPillToggle examTrack={examTrack} />
          {r.exact100 !== null && (
            <span className={`chip ${r.passed ? "is-pass" : "is-danger"}`}>
              {r.passed ? "实测已过及格线" : r.eliminated.length ? "单项淘汰未过" : "总分未达 50"}
            </span>
          )}
          {staleParts.length > 0 && (
            <span className="chip exam-chip-stale" title="超过 30 天的成绩波动区间增大，建议近期重测">
              <Clock size={13} /> {staleParts.length} 科超 30 天未重测
            </span>
          )}
          {r.gapToTarget !== null && (
            <span className="chip">
              <Award size={13} />{" "}
              {r.gapToTarget === 0 ? `已达 ${r.target}+ 目标` : `距 ${r.target}+ 还差 ${num(r.gapToTarget)} 分`}
            </span>
          )}
        </div>
      </div>

      {r.eliminated.length > 0 && (
        <div className="exam-alert" role="alert">
          <AlertTriangle size={16} />
          <span>
            <b>淘汰红线预警（&lt;5/25）：</b>
            DELF B2 规定任一单项低于 5/25 即总分达 50 分也判不及格。当前风险科目：
            {r.eliminated.map((p) => `${p.label} ${num(p.score25!)}/25`).join("、")}。
          </span>
        </div>
      )}

      <div className="exam-four-grid">
        {r.parts.map((p) => {
          const recency = formatAgeLabel(p.at, now);
          const partBand = p.score25 !== null ? (recency.stale ? "±1.5" : "±1") : null;
          return (
            <div
              key={p.part}
              className={`exam-four-cell ${p.eliminatory ? "is-danger" : p.score25 !== null && p.score25 >= 18.75 ? "is-strong" : ""} ${recency.stale ? "is-stale" : ""}`}
            >
              <span className="eyebrow">{PART_LABEL[p.part]}</span>
              <strong className="exam-four-score">
                {p.score25 !== null ? (
                  <>
                    {num(p.score25)}
                    <small>/25（{partBand}）</small>
                  </>
                ) : p.incompleteSpeak ? (
                  <small className="muted">
                    {p.latestRaw?.typed ? "打字场次不计" : `${num(p.latestRaw?.score ?? 0)}/20（缺发音分）`}
                  </small>
                ) : (
                  <small className="muted">待实测</small>
                )}
              </strong>
              <span className="muted small">
                {p.eliminatory
                  ? `低于 5 分红线 · ${recency.text}`
                  : p.score25 !== null
                    ? `${p.score25 >= 18.75 ? "达 75+ 均值" : "及格（≥5）"} · ${recency.text}`
                    : "需完成已核验整套作答"}
              </span>
            </div>
          );
        })}
      </div>

      {unverifiedItems.length > 0 && (
        <div className="exam-unverified-strip" role="note" aria-label="未核验自评与定级参考">
          <span className="eyebrow">未核验参考（离线自评 / 定级摸底 · 独立展示，不计入 /100 正式通过线）</span>
          <div className="exam-unverified-chips">
            {unverifiedItems.map((u) => (
              <span key={u.part} className="chip">
                {u.label} <b>{num(u.score25)}/25</b> · {u.source}
                {u.stale ? "（>30 天）" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="exam-dash-foot">
        <p className="muted small">
          及格标准：总分 ≥50/100 且四项均 ≥5/25；冲刺 {r.target}+ 需四科平均 ≥{num(Math.round((r.target / 4) * 10) / 10)}/25。
          {r.weakest && r.completed >= 2 ? ` 当前最弱项：${r.weakest.label}（${num(r.weakest.score25!)}/25）。` : ""}
        </p>
        {onStartMock && (
          <button className="btn btn-primary" onClick={onStartMock}>
            <PlayCircle size={16} /> 四项全真模考（2h30 笔试 + 口语） <ArrowRight size={15} />
          </button>
        )}
      </div>
    </section>
  );
}
