import type { SubtitleCue } from "./lounge-types";

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const FRENCH_LETTER_RE = /[A-Za-zÀ-ÿŒœÆæ]/;

const TIMECODE_LINE_RE =
  /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})(?:\s+.*)?$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  oelig: "œ",
  OElig: "Œ",
  aelig: "æ",
  AElig: "Æ",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  ccedil: "ç",
  Ccedil: "Ç",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
};

function decodeSubtitleEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z0-9]+);/g, (full, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const cp = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    }
    if (code.startsWith("#")) {
      const cp = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    }
    return NAMED_ENTITIES[code] ?? full;
  });
}

function parseTimestampSec(raw: string): number {
  const [hms, msRaw = "0"] = raw.trim().split(/[.,]/);
  const parts = hms.split(":").map((n) => Number.parseInt(n, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  let hours = 0;
  let mins: number;
  let secs: number;
  if (parts.length === 3) {
    [hours, mins, secs] = parts;
  } else if (parts.length === 2) {
    [mins, secs] = parts;
  } else {
    return NaN;
  }
  const ms = Number.parseInt(msRaw.padEnd(3, "0").slice(0, 3), 10);
  if (!Number.isFinite(ms) || ms < 0) return NaN;
  return hours * 3600 + mins * 60 + secs + ms / 1000;
}

function cleanCueLine(line: string): string {
  const stripped = line
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "");
  return decodeSubtitleEntities(stripped).replace(/[ \t\u00a0]+/g, " ").trim();
}

/**
 * Parse `.vtt` or `.srt` subtitle text into normalized `SubtitleCue[]`.
 * Strips WebVTT/SRT styling & voice tags (`<c>`, `<i>`, `<v>`, etc.) and splits bilingual
 * cues where the trailing line(s) contain CJK and preceding lines contain French into `{ fr, zh }`.
 */
export function parseSubtitles(raw: string): SubtitleCue[] {
  if (!raw || typeof raw !== "string") return [];
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const rawBlock of blocks) {
    const lines = rawBlock.split("\n").map((l) => l.trim());
    while (lines.length && !lines[0]) lines.shift();
    if (!lines.length) continue;

    const head = lines[0];
    if (
      /^WEBVTT(?:\s|$)/i.test(head) ||
      /^NOTE(?:\s|$)/i.test(head) ||
      /^STYLE(?:\s|$)/i.test(head) ||
      /^REGION(?:\s|$)/i.test(head)
    ) {
      // Handle compact files where a cue follows WEBVTT header with only a single newline
      const tcIdxInHeader = lines.findIndex((l) => TIMECODE_LINE_RE.test(l));
      if (tcIdxInHeader < 0 || !/^WEBVTT(?:\s|$)/i.test(head)) continue;
      lines.splice(0, tcIdxInHeader);
    }

    const tcIdx = lines.findIndex((l) => TIMECODE_LINE_RE.test(l));
    if (tcIdx < 0) continue;

    const match = TIMECODE_LINE_RE.exec(lines[tcIdx]);
    if (!match) continue;
    const start = parseTimestampSec(match[1]);
    const end = parseTimestampSec(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const textLines = lines
      .slice(tcIdx + 1)
      .map(cleanCueLine)
      .filter(Boolean);
    if (!textLines.length) continue;

    if (textLines.length >= 2 && CJK_RE.test(textLines[textLines.length - 1])) {
      let splitAt = textLines.length - 1;
      while (splitAt > 1 && CJK_RE.test(textLines[splitAt - 1]) && !FRENCH_LETTER_RE.test(textLines[splitAt - 1])) {
        splitAt--;
      }
      const frLines = textLines.slice(0, splitAt);
      const zhLines = textLines.slice(splitAt);
      if (frLines.some((l) => FRENCH_LETTER_RE.test(l))) {
        cues.push({
          start,
          end,
          fr: frLines.join(" "),
          zh: zhLines.join(" "),
        });
        continue;
      }
    }

    cues.push({
      start,
      end,
      fr: textLines.join(" "),
    });
  }

  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues;
}

/**
 * Find the active cue index at `timeSec` (`start <= timeSec < end`), or `-1` when between/outside cues.
 */
export function activeCueIndex(cues: readonly SubtitleCue[], timeSec: number): number {
  if (!cues.length || !Number.isFinite(timeSec)) return -1;
  let lo = 0;
  let hi = cues.length - 1;
  let rightMostStart = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].start <= timeSec) {
      rightMostStart = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (rightMostStart < 0) return -1;
  for (let i = rightMostStart; i >= 0; i--) {
    const cue = cues[i];
    if (timeSec >= cue.start && timeSec < cue.end) return i;
    if (timeSec - cue.start > 120) break;
  }
  return -1;
}
