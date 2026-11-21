/** 每日一分钟口语: counted per day in the progress (and so in backups). */
import { addDrill } from "../lib/drill";
import { dayKey, store, useStore } from "./store";

export function logDrill() {
  store.progress((p) => ({ ...p, drillDays: addDrill(p.drillDays, dayKey()) }));
}

/** Drills done today. */
export const useDrillsToday = () => useStore((s) => s.progress.drillDays?.[dayKey()] ?? 0);
