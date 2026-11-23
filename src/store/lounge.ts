import { createIdb } from "../lib/idb";
import type {
  BookProgressEntry,
  LocalLoungeVideoMeta,
  LoungeMode,
  MediaProgressEntry,
  SavedLoungeClip,
  StoredUserBook,
  SubtitleCue,
} from "../lib/lounge-types";
import { parseSubtitles } from "../lib/subtitles";
import {
  clearLoungeMedia,
  deleteLoungeVideoRecords,
  deleteRealMedia,
  getRealMedia,
  inspectLoungeMedia,
  listLoungeVideoMetas,
  saveLoungeVideoMeta,
  saveRealMedia,
  subMediaKey,
  videoMediaKey,
  ytSubMediaKey,
} from "./real-media";
import {
  MAX_BOOK_PROGRESS,
  MAX_LOUNGE_CLIPS,
  MAX_LOUNGE_DAYS,
  MAX_MEDIA_PROGRESS,
  clearTombstone,
  dayKey,
  markTombstone,
  store,
  type Progress,
} from "./store";

const BOOKS_DB = "fb2-books";
const BOOKS_STORE = "books";

const booksIdb = createIdb(BOOKS_DB, 1, (db) => {
  if (!db.objectStoreNames.contains(BOOKS_STORE)) {
    db.createObjectStore(BOOKS_STORE);
  }
});

const booksTx = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  booksIdb.tx(BOOKS_STORE, mode, fn);

const isStoredUserBook = (v: unknown): v is StoredUserBook =>
  !!v &&
  typeof v === "object" &&
  typeof (v as StoredUserBook).id === "string" &&
  typeof (v as StoredUserBook).title === "string" &&
  Array.isArray((v as StoredUserBook).chapters);

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export async function saveUserBook(book: StoredUserBook): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const ok = await booksTx("readwrite", (s) => s.put(book, book.id));
  return ok !== null;
}

export async function listUserBooks(): Promise<StoredUserBook[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await booksTx("readonly", (s) => s.getAll());
  if (!Array.isArray(all)) return [];
  return all.filter(isStoredUserBook).sort((a, b) => b.created - a.created);
}

export async function getUserBook(id: string): Promise<StoredUserBook | null> {
  if (typeof indexedDB === "undefined" || !id) return null;
  const v = await booksTx("readonly", (s) => s.get(id));
  return isStoredUserBook(v) ? v : null;
}

export async function deleteUserBook(id: string): Promise<void> {
  if (typeof indexedDB === "undefined" || !id) return;
  await booksTx("readwrite", (s) => s.delete(id));
}

export async function saveLocalLoungeVideo(input: {
  title?: string;
  videoFile: File;
  subFile?: File | null;
}): Promise<LocalLoungeVideoMeta> {
  const id = `lv-${rid()}`;
  const fallbackTitle =
    input.videoFile.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "本地视频";
  const title = (input.title?.trim() || fallbackTitle).slice(0, 160);
  const videoMime = input.videoFile.type || "video/mp4";

  let cues: SubtitleCue[] = [];
  if (input.subFile) {
    const rawSub = await input.subFile.text();
    cues = parseSubtitles(rawSub);
    await saveRealMedia(
      subMediaKey(id),
      new Blob([rawSub], { type: "text/plain;charset=utf-8" }),
      input.subFile.name || "subtitles.vtt",
      input.subFile.type || "text/vtt",
    );
  }

  const savedVideo = await saveRealMedia(videoMediaKey(id), input.videoFile, input.videoFile.name || "video.mp4", videoMime);
  if (!savedVideo && typeof indexedDB !== "undefined") {
    throw new Error("无法将视频保存到浏览器本地存储（可能存储空间不足）");
  }

  const meta: LocalLoungeVideoMeta = {
    id,
    title,
    created: Date.now(),
    videoBytes: input.videoFile.size,
    videoMime,
    hasSubtitles: cues.length > 0,
    cueCount: cues.length,
  };
  await saveLoungeVideoMeta(meta);
  return meta;
}

export async function listLocalLoungeVideos(): Promise<LocalLoungeVideoMeta[]> {
  return listLoungeVideoMetas();
}

export async function loadLocalLoungeVideoUrls(
  id: string,
): Promise<{ videoBlob: Blob | null; cues: SubtitleCue[] }> {
  if (!id) return { videoBlob: null, cues: [] };
  const [videoRec, subRec] = await Promise.all([
    getRealMedia(videoMediaKey(id)),
    getRealMedia(subMediaKey(id)),
  ]);
  let cues: SubtitleCue[] = [];
  if (subRec?.blob) {
    const raw = await subRec.blob.text();
    cues = parseSubtitles(raw);
  }
  return {
    videoBlob: videoRec?.blob ?? null,
    cues,
  };
}

export async function deleteLocalLoungeVideo(id: string): Promise<void> {
  if (!id) return;
  await deleteLoungeVideoRecords(id);
}

export async function saveYoutubeCustomSubtitles(videoId: string, rawSubText: string): Promise<SubtitleCue[]> {
  const cleanId = videoId.trim();
  if (!cleanId) return [];
  if (!rawSubText.trim()) {
    await deleteRealMedia(ytSubMediaKey(cleanId));
    return [];
  }
  const cues = parseSubtitles(rawSubText);
  await saveRealMedia(
    ytSubMediaKey(cleanId),
    new Blob([rawSubText], { type: "text/plain;charset=utf-8" }),
    `${cleanId}.vtt`,
    "text/vtt",
  );
  return cues;
}

export async function loadYoutubeCustomSubtitles(videoId: string): Promise<SubtitleCue[]> {
  const cleanId = videoId.trim();
  if (!cleanId) return [];
  const rec = await getRealMedia(ytSubMediaKey(cleanId));
  if (!rec?.blob) return [];
  const raw = await rec.blob.text();
  return parseSubtitles(raw);
}

export async function estimateLoungeIdbBytes(): Promise<{
  booksBytes: number;
  videosBytes: number;
  bookCount: number;
  videoCount: number;
}> {
  const [books, mediaStats] = await Promise.all([listUserBooks(), inspectLoungeMedia()]);
  const booksBytes = books.reduce((sum, b) => sum + Math.max(0, b.byteSize || 0), 0);
  return {
    booksBytes,
    videosBytes: mediaStats.videosBytes,
    bookCount: books.length,
    videoCount: mediaStats.videoCount,
  };
}

export async function clearAllLoungeIdb(): Promise<void> {
  await Promise.all([
    typeof indexedDB !== "undefined" ? booksTx("readwrite", (s) => s.clear()) : Promise.resolve(null),
    clearLoungeMedia(),
  ]);
}

export function setLoungeMode(mode: LoungeMode): void {
  if (mode !== "chill" && mode !== "study") return;
  store.settings({ loungeMode: mode });
}

export function updateBookProgress(
  bookId: string,
  patch: Partial<BookProgressEntry> & { ch: number; ratio: number },
): void {
  const id = bookId.trim();
  if (!id) return;
  store.progress((p) => {
    const prev = p.bookProgress?.[id];
    const done = patch.done !== undefined ? patch.done : prev?.done;
    const title = (patch.title ?? prev?.title)?.trim().slice(0, 200);
    const nextEntry: BookProgressEntry = {
      ch: Math.max(0, Math.floor(Number.isFinite(patch.ch) ? patch.ch : 0)),
      para: Math.max(0, Math.floor(Number.isFinite(patch.para) ? (patch.para as number) : (prev?.para ?? 0))),
      ratio: Math.min(1, Math.max(0, Number.isFinite(patch.ratio) ? patch.ratio : 0)),
      updatedAt: patch.updatedAt ?? Date.now(),
      ...(typeof done === "number" && done > 0 ? { done } : {}),
      ...(title ? { title } : {}),
    };
    const entries = Object.entries({ ...(p.bookProgress ?? {}), [id]: nextEntry })
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_BOOK_PROGRESS);
    return { ...p, bookProgress: Object.fromEntries(entries) };
  });
}

export function recordLoungeActivity(now = new Date()): void {
  const k = dayKey(now);
  store.progress((p) => {
    const nextCount = Math.min(1000, (p.loungeDays?.[k] ?? 0) + 1);
    const entries = Object.entries({ ...(p.loungeDays ?? {}), [k]: nextCount })
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, MAX_LOUNGE_DAYS);
    return { ...p, loungeDays: Object.fromEntries(entries) };
  });
}

export function markBookChapterDone(
  bookId: string,
  ch: number,
  totalChapters: number,
  title?: string,
): void {
  const id = bookId.trim();
  if (!id) return;
  const now = Date.now();
  const safeCh = Math.max(0, Math.floor(Number.isFinite(ch) ? ch : 0));
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(totalChapters) ? totalChapters : 1));
  const isFinal = safeCh + 1 >= safeTotal;

  if (isFinal) {
    updateBookProgress(id, {
      ch: safeCh,
      para: 0,
      ratio: 1,
      updatedAt: now,
      done: now,
      ...(title ? { title } : {}),
    });
  } else {
    updateBookProgress(id, {
      ch: safeCh + 1,
      para: 0,
      ratio: 0,
      updatedAt: now,
      ...(title ? { title } : {}),
    });
  }
  recordLoungeActivity(new Date(now));
}

export function updateMediaProgress(
  itemId: string,
  patch: Partial<MediaProgressEntry> & { pos: number },
): void {
  const id = itemId.trim();
  if (!id) return;
  store.progress((p) => {
    const prev = p.mediaProgress?.[id];
    const dur = patch.dur !== undefined ? patch.dur : prev?.dur;
    const done = patch.done !== undefined ? patch.done : prev?.done;
    const title = (patch.title ?? prev?.title)?.trim().slice(0, 200);
    const shelf = patch.shelf ?? prev?.shelf;
    const nextEntry: MediaProgressEntry = {
      pos: Math.max(0, Number.isFinite(patch.pos) ? patch.pos : 0),
      updatedAt: patch.updatedAt ?? Date.now(),
      ...(typeof dur === "number" && Number.isFinite(dur) && dur > 0 ? { dur } : {}),
      ...(typeof done === "number" && Number.isFinite(done) && done > 0 ? { done } : {}),
      ...(title ? { title } : {}),
      ...(shelf === "books" || shelf === "reads" || shelf === "videos" ? { shelf } : {}),
    };
    const entries = Object.entries({ ...(p.mediaProgress ?? {}), [id]: nextEntry })
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_MEDIA_PROGRESS);
    return { ...p, mediaProgress: Object.fromEntries(entries) };
  });
}

export function markMicroReadDone(readId: string, title?: string): void {
  const id = readId.trim();
  if (!id) return;
  const now = Date.now();
  updateMediaProgress(id, {
    pos: 1,
    dur: 1,
    done: now,
    updatedAt: now,
    shelf: "reads",
    ...(title ? { title } : {}),
  });
  recordLoungeActivity(new Date(now));
}

export function saveLoungeClip(input: { fr: string; zh: string; source: string }): string {
  const fr = input.fr.trim().slice(0, 1000);
  const zh = input.zh.trim().slice(0, 1000);
  const source = input.source.trim().slice(0, 200);
  if (!fr) return "";

  const existing = store.get().progress.loungeClips?.find((c) => c.fr === fr && c.source === source);
  if (existing) {
    const now = Date.now();
    store.progress((p) => {
      const updated: SavedLoungeClip = { ...existing, zh: zh || existing.zh, created: now };
      const list = [updated, ...(p.loungeClips ?? []).filter((c) => c.id !== existing.id)].slice(0, MAX_LOUNGE_CLIPS);
      return clearTombstone({ ...p, loungeClips: list }, `loungeClip:${existing.id}`);
    });
    return existing.id;
  }

  const id = `lc-${rid()}`;
  const clip: SavedLoungeClip = { id, fr, zh, source, created: Date.now() };
  store.progress((p) =>
    clearTombstone(
      {
        ...p,
        loungeClips: [clip, ...(p.loungeClips ?? [])].slice(0, MAX_LOUNGE_CLIPS),
      },
      `loungeClip:${id}`,
    ),
  );
  return id;
}

export function deleteLoungeClip(id: string): void {
  const cleanId = id.trim();
  if (!cleanId) return;
  store.progress((p) => {
    const remaining = (p.loungeClips ?? []).filter((c) => c.id !== cleanId);
    const next: Progress = { ...p };
    if (remaining.length) {
      next.loungeClips = remaining;
    } else {
      delete next.loungeClips;
    }
    return markTombstone(next, `loungeClip:${cleanId}`);
  });
}

export { latestLoungeResume } from "../lib/lounge-resume";
