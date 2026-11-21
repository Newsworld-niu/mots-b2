/** 错因: the questions missed in 听力理解 / 应试阅读 and why, kept with the progress (and so in backups). */
import { MAX_MISSES, type CompMiss } from "../lib/listening";
import { store } from "./store";

export function addMisses(list: CompMiss[]) {
  if (!list.length) return;
  store.progress((p) => ({ ...p, compMisses: [...list, ...(p.compMisses ?? [])].slice(0, MAX_MISSES) }));
}

/** Change the cause of one missed question of a paper (noted at `at`). */
export function setMissCause(at: number, q: string, cause: CompMiss["cause"]) {
  store.progress((p) => ({ ...p, compMisses: (p.compMisses ?? []).map((m) => (m.at === at && m.q === q ? { ...m, cause } : m)) }));
}
