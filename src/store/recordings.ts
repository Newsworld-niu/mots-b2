/**
 * The learner's last few recordings (口语、每日一分钟), kept in their own IndexedDB database so that they can be
 * played again after the page is closed. Never in localStorage or backups; quota is partitioned by `bucket`
 * (`MAX_EXAM_KEPT = 12`, `MAX_DRILL_KEPT = 8`) so 1-min daily drills never evict PO exam monologues.
 */

import { createIdb } from "../lib/idb";

const DB = "word-atlas-recordings";
const STORE = "recordings";
export const MAX_EXAM_KEPT = 12;
export const MAX_DRILL_KEPT = 8;
export const MAX_KEPT = MAX_EXAM_KEPT;

export type RecordingBucket = "exam" | "drill";

export interface KeptRecording {
  id: string;
  at: number;
  /** What was said: the question or subject. */
  label: string;
  seconds: number;
  blob: Blob;
  /** Quota partition ("exam" = PO monologue archive, "drill" = 1-min daily drill; legacy entries default to "exam"). */
  bucket?: RecordingBucket;
}

const bucketOf = (r: Pick<KeptRecording, "bucket">): RecordingBucket =>
  r.bucket === "drill" ? "drill" : "exam";

/** Pure quota eviction planner (exported for deterministic unit testing). */
export function selectEvictedRecordingIds<T extends { id: string; at: number; bucket?: RecordingBucket }>(
  items: readonly T[],
  limits: { exam?: number; drill?: number } = {},
): string[] {
  const maxExam = limits.exam ?? MAX_EXAM_KEPT;
  const maxDrill = limits.drill ?? MAX_DRILL_KEPT;
  const sorted = [...items].sort((a, b) => b.at - a.at);
  const exams = sorted.filter((r) => bucketOf(r) === "exam");
  const drills = sorted.filter((r) => bucketOf(r) === "drill");
  return [...exams.slice(maxExam).map((r) => r.id), ...drills.slice(maxDrill).map((r) => r.id)];
}

const recIdb = createIdb(DB, 1, (d) => {
  if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
});

const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  recIdb.tx(STORE, mode, fn);

/** Newest first; optionally filtered to `"exam"` or `"drill"`. */
export async function listRecordings(bucket?: RecordingBucket): Promise<KeptRecording[]> {
  const all = ((await run<KeptRecording[]>("readonly", (s) => s.getAll())) ?? []) as KeptRecording[];
  const valid = all.filter((r) => r && r.blob instanceof Blob).sort((a, b) => b.at - a.at);
  return bucket ? valid.filter((r) => bucketOf(r) === bucket) : valid;
}

/** Read one kept recording by id, or null when missing/expired. */
export async function getRecording(id: string): Promise<KeptRecording | null> {
  try {
    const r = await run<KeptRecording | undefined>("readonly", (s) => s.get(id));
    return r && r.blob instanceof Blob ? r : null;
  } catch {
    return null;
  }
}

/** Keep a recording in its `bucket` (`"exam"` default, or `"drill"`); drops only oldest entries in the same bucket. */
export async function keepRecording(r: Omit<KeptRecording, "id" | "at">): Promise<string | null> {
  try {
    const at = Date.now();
    const id = `r-${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const bucket: RecordingBucket = bucketOf(r);
    await run("readwrite", (s) => s.put({ ...r, bucket, id, at }));
    const all = await listRecordings();
    for (const oldId of selectEvictedRecordingIds(all)) {
      await run("readwrite", (s) => s.delete(oldId));
    }
    return id;
  } catch {
    return null;
  }
}

export async function deleteRecording(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
