import type { MutableRefObject } from "react";
import { buildDialogueSsmlBatches } from "../../ai/ssml";
import { speakerVoices, ttsOn, ttsSsmlUrl, ttsUrl } from "../../ai/tts";
import { play } from "../../lib/audio";
import { ESSAY_TASKS, type EssayFeedback } from "../../lib/essay";
import { READ_MINUTES, REAL_WPM, SPEAK_CRITERIA, SPEAK_TIMES, SPEAKING_SUBJECTS, speechChunks, speechTurns, type DebateTurn, type SpeakingFeedback } from "../../lib/exam";
import { resolveMaterialUrl, type DocVoices } from "../../lib/listening";
import { canDictate } from "../../lib/speech";
import { CRITERIA } from "../../lib/essay";
import { emptyRubric } from "../mock-exam-helpers";

export type MockStage =
  | "setup"
  | "co"
  | "ce"
  | "pe"
  | "pe_grade"
  | "break_po"
  | "po_choose"
  | "po_prep"
  | "po_talk"
  | "po_review"
  | "po_debate"
  | "po_grade"
  | "summary";

export interface MockState {
  setIdx: number;
  strict: boolean;
  stage: MockStage;
  coPicked: Record<string, number>;
  coHeard?: Record<number, boolean>;
  coScore: number | null;
  cePicked: Record<string, number>;
  ceTyped?: Record<string, string>;
  ceScore: number | null;
  peTaskId: string;
  peText: string;
  peFb: EssayFeedback | null;
  peSelf: Record<string, number | null>;
  peScore: number | null;
  poDrawnIds: string[];
  poSubjectId: string;
  poNotes: string;
  poSaid: string;
  poVoiceSaid?: string;
  poMonologueSec?: number;
  poRecordedVoice?: boolean;
  poTurns: DebateTurn[];
  poDebateVoice?: boolean;
  poSelf: Record<string, number | null>;
  poFb: SpeakingFeedback | null;
  poPhono: number | null;
  poTyped: boolean;
  poScore: number | null;
  writtenLeftSec: number;
  ceLeftSec: number;
  peLeftSec: number;
  ceAdvise60Shown?: boolean;
  poPrepLeftSec?: number;
  poTalkSec?: number;
  poDebateSec?: number;
}

export const MOCK_KEY = "fb2.mock.v1";
export const MOCK_LAST_KEY = "fb2.mock.last.v1";
export const num = (n: number) => String(n);

export function initialMock(setIdx: number, strict: boolean): MockState {
  const safeIdx = Number.isFinite(setIdx) && setIdx >= 0 ? Math.floor(setIdx) : 0;
  const b2Essays = ESSAY_TASKS.filter((t) => t.level === "B2");
  const peTask = b2Essays[safeIdx % b2Essays.length];
  const nSubj = SPEAKING_SUBJECTS.length;
  const drawn = [
    SPEAKING_SUBJECTS[(safeIdx * 2) % nSubj],
    SPEAKING_SUBJECTS[(safeIdx * 2 + 1) % nSubj],
  ];
  const pooledCePeSec = (READ_MINUTES.paper + 60) * 60;
  return {
    setIdx: safeIdx,
    strict,
    stage: "co",
    coPicked: {},
    coHeard: {},
    coScore: null,
    cePicked: {},
    ceTyped: {},
    ceScore: null,
    peTaskId: peTask.id,
    peText: "",
    peFb: null,
    peSelf: emptyRubric(CRITERIA),
    peScore: null,
    poDrawnIds: drawn.map((d) => d.id),
    poSubjectId: drawn[0].id,
    poNotes: "",
    poSaid: "",
    poVoiceSaid: "",
    poMonologueSec: 0,
    poRecordedVoice: false,
    poTurns: [],
    poDebateVoice: false,
    poSelf: emptyRubric([...SPEAK_CRITERIA, "phono"]),
    poFb: null,
    poPhono: null,
    poTyped: !canDictate(),
    poScore: null,
    writtenLeftSec: 150 * 60,
    ceLeftSec: pooledCePeSec,
    peLeftSec: pooledCePeSec,
    ceAdvise60Shown: false,
    poPrepLeftSec: SPEAK_TIMES.prep,
    poTalkSec: 0,
    poDebateSec: 0,
  };
}

export function loadJson(key: string): MockState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MockState) : null;
  } catch {
    return null;
  }
}

export const loadMock = () => loadJson(MOCK_KEY);

export function saveMock(s: MockState | null) {
  try {
    if (s) localStorage.setItem(MOCK_KEY, JSON.stringify(s));
    else localStorage.removeItem(MOCK_KEY);
  } catch {
    /* ignore storage quota failure */
  }
}

export function saveLastMock(s: MockState) {
  try {
    localStorage.setItem(MOCK_LAST_KEY, JSON.stringify(s));
  } catch {
    /* ignore storage quota failure */
  }
}

export async function sayMockDoc(
  text: string,
  mine: number,
  runRef: MutableRefObject<number>,
  dv?: DocVoices,
  style: "radio" | "natural" = "natural",
  audioUrl?: string,
): Promise<boolean> {
  if (audioUrl) {
    const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
    const resolved = resolveMaterialUrl(audioUrl.replace(/^\//, ""), base);
    const r = await play(resolved, "", "uk", 1);
    if (runRef.current !== mine || r === "stopped") return false;
    if (r === "recorded") return true;
  }
  const pool = dv && dv.voices.length >= 3 ? dv.voices : speakerVoices();
  if (ttsOn()) {
    try {
      const batches = buildDialogueSsmlBatches(speechTurns(text), pool, { style });
      const urls = await Promise.all(batches.map((ssml) => ttsSsmlUrl(ssml)));
      if (runRef.current !== mine) return false;
      for (const u of urls) {
        const r = await play(u, "", "uk", 1);
        if (runRef.current !== mine || r === "stopped" || r === "unsupported") return false;
      }
      return true;
    } catch {
      if (runRef.current !== mine) return false;
    }
  }
  const chunks = speechChunks(text);
  const urls = ttsOn() ? await Promise.all(chunks.map((c) => ttsUrl(c.t, pool[c.who % pool.length]).catch(() => ""))) : [];
  if (runRef.current !== mine) return false;
  for (const [k, c] of chunks.entries()) {
    const r = await play(urls[k] || null, c.t, "uk", REAL_WPM / 177, c.who);
    if (runRef.current !== mine || r === "stopped" || r === "unsupported") return false;
  }
  return true;
}
