import { CRITERIA, CRITERION_LABEL, maxScore, totalScore, type SavedEssay } from "../lib/essay";

const W = 560;
const H = 150;
const PAD = { l: 28, r: 10, t: 10, b: 20 };
const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
const avg = (xs: number[]) => xs.reduce((n, v) => n + v, 0) / xs.length;

/**
 * 写作进步: the total of each marked first draft over time (out of 25), and per criterion the first mark against the
 * recent ones, so the learner sees whether vocabulary is climbing or grammar is holding the total back. How much
 * the second draft gained is shown when there are any.
 */
export function EssayTrend({ essays }: { essays: SavedEssay[] }) {
  const marked = essays
    .filter((e) => e.fb)
    .sort((a, b) => a.created - b.created)
    .slice(-20);
  if (marked.length === 0) return <p className="muted">还没有批改过的作文。在「练习 → 篇章」写一篇并交给 AI 批改后，这里会画出每次的分数。</p>;

  const max = 25;
  const x = (i: number) => PAD.l + (marked.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (marked.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const pts = marked.map((e, i) => [x(i), y(totalScore(e.fb!))] as const);
  const last = marked[marked.length - 1];
  const first = marked[0];

  const recent = marked.slice(-3);
  const revised = essays.filter((e) => e.fb && e.rev?.fb);
  const gains = revised.map((e) => totalScore(e.rev!.fb!) - totalScore(e.fb!));

  return (
    <>
      <p className="essay-gain">
        {totalScore(last.fb!)}
        <small>/{maxScore(last.fb!)}</small>
        {marked.length > 1 && (
          <span className={totalScore(last.fb!) >= totalScore(first.fb!) ? "is-up" : "is-down"}>
            {" "}
            比第一篇 {totalScore(last.fb!) - totalScore(first.fb!) >= 0 ? "+" : ""}
            {totalScore(last.fb!) - totalScore(first.fb!)}
          </span>
        )}
      </p>
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`最近 ${marked.length} 篇作文的分数，满分 25`}>
        {[0, 5, 10, 15, 20, 25].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} className="trend-grid" />
            <text x={PAD.l - 6} y={y(g) + 4} className="trend-tick" textAnchor="end">
              {g}
            </text>
          </g>
        ))}
        {pts.length > 1 && <polyline className="trend-line" fill="none" points={pts.map((p) => p.join(",")).join(" ")} />}
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={4} className="trend-dot">
            <title>
              {day(marked[i].created)} · {totalScore(marked[i].fb!)}/25
            </title>
          </circle>
        ))}
        <text x={PAD.l} y={H - 4} className="trend-tick">
          {day(first.created)}
        </text>
        {marked.length > 1 && (
          <text x={W - PAD.r} y={H - 4} className="trend-tick" textAnchor="end">
            {day(last.created)}
          </text>
        )}
      </svg>
      <dl className="essay-scores trend-crit">
        {CRITERIA.map((c) => {
          const now = avg(recent.map((e) => e.fb!.scores[c] ?? 0));
          const was = first.fb!.scores[c] ?? 0;
          const d = now - was;
          return (
            <div key={c}>
              <dt>{CRITERION_LABEL[c]}</dt>
              <dd>
                <span className="essay-bar">
                  <span style={{ width: `${(now / 5) * 100}%` }} />
                </span>
                最近 {now.toFixed(1)}/5
                {marked.length > 1 && (
                  <span className={d > 0.05 ? "is-up" : d < -0.05 ? "is-down" : ""}>
                    {" "}
                    {d > 0.05 ? `↑ 比第一篇多 ${d.toFixed(1)}` : d < -0.05 ? `↓ 比第一篇少 ${(-d).toFixed(1)}` : "和第一篇持平"}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {gains.length > 0 && (
        <p className="muted">
          改过第二稿的 {gains.length} 篇，平均 {avg(gains) >= 0 ? "+" : ""}
          {avg(gains).toFixed(1)} 分。
        </p>
      )}
      <p className="muted small">按每篇第一稿的分数画，最近 {marked.length} 篇；分数由 AI 按官方评分表打出，只作自己和自己比较。</p>
    </>
  );
}
