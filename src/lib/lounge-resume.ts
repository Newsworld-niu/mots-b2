import type { LoungeShelf } from "./lounge-types";
import type { Progress } from "../store/types";

function formatSecLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, "0");
  return `${mins}:${rem}`;
}

export function latestLoungeResume(
  p: Pick<Progress, "bookProgress" | "mediaProgress">,
): {
  shelf: LoungeShelf;
  item: string;
  ch?: number;
  title: string;
  label: string;
  updatedAt: number;
} | null {
  let best: {
    shelf: LoungeShelf;
    item: string;
    ch?: number;
    title: string;
    label: string;
    updatedAt: number;
  } | null = null;

  for (const [bookId, entry] of Object.entries(p.bookProgress ?? {})) {
    if (entry.done) continue;
    const pct = Math.round(Math.min(1, Math.max(0, entry.ratio)) * 100);
    const label = pct > 0 ? `第 ${entry.ch + 1} 章 · ${pct}%` : `续读第 ${entry.ch + 1} 章`;
    if (!best || entry.updatedAt > best.updatedAt) {
      best = {
        shelf: "books",
        item: bookId,
        ch: entry.ch,
        title: entry.title || bookId,
        label,
        updatedAt: entry.updatedAt,
      };
    }
  }

  for (const [itemId, entry] of Object.entries(p.mediaProgress ?? {})) {
    if (entry.done) continue;
    const shelf: LoungeShelf = entry.shelf ?? "videos";
    const label =
      shelf === "reads"
        ? entry.dur && entry.dur > 0
          ? `阅读进度 ${Math.round(Math.min(1, entry.pos / entry.dur) * 100)}%`
          : "继续阅读"
        : `观看至 ${formatSecLabel(entry.pos)}`;
    if (!best || entry.updatedAt > best.updatedAt) {
      best = {
        shelf,
        item: itemId,
        title: entry.title || itemId,
        label,
        updatedAt: entry.updatedAt,
      };
    }
  }

  return best;
}
