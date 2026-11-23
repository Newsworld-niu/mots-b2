/** Total built-in 1-minute speaking drills (validated against DRILL_QUESTIONS.length in unit tests). */
export const DRILL_QUESTIONS_COUNT = 24;

/** Drills done per day (dayKey → count), as kept in the progress and in backups. Undefined when there are none. */
export function sanitizeDrillDays(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>))
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 1000) out[k] = n;
  const keys = Object.keys(out).sort().slice(0, -730);
  for (const k of keys) delete out[k];
  return Object.keys(out).length ? out : undefined;
}

/** One more drill on `day`. */
export const addDrill = (days: Record<string, number> | undefined, day: string): Record<string, number> => ({ ...days, [day]: (days?.[day] ?? 0) + 1 });
