export interface TimedSegment {
  idx: number;
  start: number;
  end: number;
  text: string;
  who?: string;
}

export interface RfiSegmentsFile {
  id: string;
  audio: string;
  duration: number;
  method: "azure-fast-stt" | "ffmpeg-silence-align";
  segments: TimedSegment[];
}

const CACHE = new Map<string, Promise<RfiSegmentsFile | null>>();

/** Validate a decoded RFI sentence-timestamp manifest before exposing slices in the UI. */
export function parseRfiSegments(raw: unknown): RfiSegmentsFile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || typeof r.audio !== "string") return null;
  if (typeof r.duration !== "number" || !Number.isFinite(r.duration) || r.duration <= 0) return null;
  if (r.method !== "azure-fast-stt" && r.method !== "ffmpeg-silence-align") return null;
  if (!Array.isArray(r.segments) || r.segments.length === 0) return null;
  const segments: TimedSegment[] = [];
  let prevStart = -1;
  for (const item of r.segments) {
    if (!item || typeof item !== "object") return null;
    const s = item as Record<string, unknown>;
    if (
      typeof s.idx !== "number" ||
      typeof s.start !== "number" ||
      typeof s.end !== "number" ||
      !Number.isFinite(s.start) ||
      !Number.isFinite(s.end) ||
      s.start < 0 ||
      s.end <= s.start ||
      s.start < prevStart ||
      typeof s.text !== "string" ||
      !s.text.trim()
    ) {
      return null;
    }
    prevStart = s.start;
    segments.push({
      idx: s.idx,
      start: s.start,
      end: s.end,
      text: s.text,
      ...(typeof s.who === "string" && s.who.trim() ? { who: s.who.trim() } : {}),
    });
  }
  return { id: r.id, audio: r.audio, duration: r.duration, method: r.method, segments };
}

/** Load and validate `materials/rfi/<presetId>.segments.json` with in-memory memoization. */
export function loadRfiSegments(presetId: string, base = "/"): Promise<RfiSegmentsFile | null> {
  if (!presetId) return Promise.resolve(null);
  const url = `${base.replace(/\/?$/, "/")}materials/rfi/${presetId}.segments.json`;
  let p = CACHE.get(url);
  if (!p) {
    p = fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const parsed = parseRfiSegments(data);
        if (!parsed) CACHE.delete(url);
        return parsed;
      })
      .catch(() => {
        CACHE.delete(url);
        return null;
      });
    CACHE.set(url, p);
  }
  return p;
}
