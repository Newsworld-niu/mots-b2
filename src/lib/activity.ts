import { dayKey, type Progress } from "../store/store";

export interface DailyActivity {
  r: number;
  ms: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ActivityProgress = Pick<
  Progress,
  "days" | "gramDays" | "conjDays" | "drillDays" | "loungeDays" | "examLog" | "essays" | "listenSources" | "texts"
>;

/**
 * Aggregate daily learning activity across all modules (vocabulary SRS, grammar, conjugation,
 * 1-minute speaking drills, Lounge light immersions, exams/comprehension, essays/revisions, RFI/FEI listening, and texts).
 */
export function dailyActivityMap(p: ActivityProgress): Record<string, DailyActivity> {
  const map: Record<string, DailyActivity> = {};
  const add = (k: string, r: number, ms: number) => {
    if (!DAY_RE.test(k)) return;
    const count = Number.isFinite(r) && r > 0 ? Math.round(r) : 0;
    const dur = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
    if (!count && !dur) return;
    const cur = map[k];
    if (cur) {
      cur.r += count;
      cur.ms += dur;
    } else {
      map[k] = { r: count, ms: dur };
    }
  };

  for (const [k, s] of Object.entries(p.days ?? {})) {
    add(k, s.r ?? 0, (s.t ?? 0) * 1000);
  }
  for (const [k, s] of Object.entries(p.gramDays ?? {})) {
    add(k, s.r ?? 0, (s.r ?? 0) * 15_000);
  }
  for (const [k, s] of Object.entries(p.conjDays ?? {})) {
    add(k, s.r ?? 0, (s.r ?? 0) * 10_000);
  }
  for (const [k, count] of Object.entries(p.drillDays ?? {})) {
    add(k, count ?? 0, (count ?? 0) * 90_000);
  }
  for (const [k, count] of Object.entries(p.loungeDays ?? {})) {
    add(k, count ?? 0, (count ?? 0) * 300_000);
  }
  for (const e of p.examLog ?? []) {
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    add(dayKey(new Date(e.at)), 1, e.scope === "full" ? 1_200_000 : 300_000);
  }
  for (const e of p.essays ?? []) {
    if (typeof e.created === "number" && Number.isFinite(e.created)) {
      add(dayKey(new Date(e.created)), 1, 900_000);
    }
    if (typeof e.rev?.at === "number" && Number.isFinite(e.rev.at)) {
      add(dayKey(new Date(e.rev.at)), 1, 600_000);
    }
  }
  for (const s of p.listenSources ?? []) {
    if (typeof s.done === "number" && Number.isFinite(s.done) && s.done > 0) {
      add(dayKey(new Date(s.done)), 1, 600_000);
    }
  }
  for (const t of p.texts ?? []) {
    const at = typeof t.read === "number" && Number.isFinite(t.read) && t.read > 0 ? t.read : t.created;
    if (typeof at === "number" && Number.isFinite(at) && at > 0) {
      add(dayKey(new Date(at)), 1, 300_000);
    }
  }

  return map;
}

/** Consecutive active days across all modules ending today or yesterday. */
export function unifiedStreakOf(p: ActivityProgress, now = new Date()): number {
  const map = dailyActivityMap(p);
  let n = 0;
  const d = new Date(now);
  if (!(map[dayKey(d)]?.r > 0)) d.setDate(d.getDate() - 1);
  while (map[dayKey(d)]?.r > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Total active minutes across all modules (actual vocab seconds + conservative module estimates). */
export function unifiedMinutes(p: ActivityProgress): number {
  const map = dailyActivityMap(p);
  let totalMs = 0;
  for (const day of Object.values(map)) totalMs += day.ms;
  return Math.round(totalMs / 60_000);
}

/** Rolling 7-day activity summary across all modules for the Today week chart. */
export function unifiedWeek(
  p: ActivityProgress,
  now = new Date(),
): { k: string; label: string; v: number; today: boolean }[] {
  const map = dailyActivityMap(p);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const k = dayKey(d);
    return { k, label: "日一二三四五六"[d.getDay()], v: map[k]?.r ?? 0, today: i === 6 };
  });
}
