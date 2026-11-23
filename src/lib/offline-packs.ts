import type { Atlas } from "../atlas/types";
import { MEDIA } from "../atlas/types";
import { resolveMediaUrl } from "./media";

export const OFFLINE_MEDIA_CACHE = "atlas-offline-media";
export const SW_MEDIA_CACHE = "atlas-v6-media";

export type OfflinePackId = "co-audio" | "rfi-real" | "b2-core-audio";

export interface OfflinePack {
  id: OfflinePackId;
  title: string;
  desc: string;
  urls: string[];
  estimatedBytes: number;
}

export interface OfflinePackStatus {
  id: OfflinePackId;
  total: number;
  cached: number;
  bytes: number;
  ready: boolean;
}

export interface OfflineProgress {
  done: number;
  total: number;
  skipped: number;
  bytesAdded: number;
}

export interface StorageStats {
  supported: boolean;
  usage: number;
  quota: number;
  persisted: boolean | null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function normalizeAbsoluteUrl(raw: string, base: string, origin: string): string {
  const resolved = resolveMediaUrl(raw, base);
  try {
    const u = new URL(resolved, origin);
    u.hash = "";
    return u.href;
  } catch {
    return resolved;
  }
}

/** Build the 3 offline learning packs dynamically (no static import of heavy preset banks). */
export async function getOfflinePacks(
  atlas?: Atlas | null,
  base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/",
  origin = typeof window !== "undefined" ? window.location.origin : "http://localhost",
): Promise<OfflinePack[]> {
  const [{ PRESET_PAPERS }, { PREBUILT_REAL_SOURCES }] = await Promise.all([
    import("./exam-presets"),
    import("./real-presets"),
  ]);

  const coSet = new Set<string>();
  for (const paper of PRESET_PAPERS) {
    if (paper.kind !== "listen") continue;
    for (const ex of paper.exs) {
      for (const doc of ex.docs) {
        if (doc.audioUrl) coSet.add(normalizeAbsoluteUrl(doc.audioUrl, base, origin));
      }
    }
  }
  const coUrls = [...coSet];

  const rfiSet = new Set<string>();
  for (const s of PREBUILT_REAL_SOURCES) {
    rfiSet.add(normalizeAbsoluteUrl(s.url, base, origin));
    if (s.pdfUrl) rfiSet.add(normalizeAbsoluteUrl(s.pdfUrl, base, origin));
    const segId = s.presetId ?? s.id;
    rfiSet.add(normalizeAbsoluteUrl(`materials/rfi/${segId}.segments.json`, base, origin));
  }
  const rfiUrls = [...rfiSet];

  const b2Set = new Set<string>();
  if (atlas) {
    for (const w of atlas.words) {
      if (w.cefr !== 3 || !(w.media & MEDIA.uk)) continue;
      const u = atlas.audio(w, "uk");
      if (!u) continue;
      try {
        const full = new URL(u, origin);
        full.hash = "";
        b2Set.add(full.href);
      } catch {
        b2Set.add(u);
      }
      if (b2Set.size >= 500) break;
    }
  }
  const b2Urls = [...b2Set];

  return [
    {
      id: "co-audio",
      title: "CO 听力真题包（5 套多口音 MP3）",
      desc: "覆盖内置 5 套完整 DELF B2 听力真题，包含法/加/比/瑞多国法语神经朗读音频。",
      urls: coUrls,
      estimatedBytes: Math.max(coUrls.length, 1) * 720 * 1024,
    },
    {
      id: "rfi-real",
      title: "RFI 真实新闻精听包（6 期原声 + 文稿 + 时间戳）",
      desc: "包含 6 期《Journal en français facile》原声广播、全文文稿及逐句切片时间戳。",
      urls: rfiUrls,
      estimatedBytes: 28 * 1024 * 1024,
    },
    {
      id: "b2-core-audio",
      title: "B2 核心高频词语音包（前 500 词发音）",
      desc: "精选 B2 级别高频词条女声真人感标准读音，离线刷卡与听音识词零卡顿。",
      urls: b2Urls,
      estimatedBytes: Math.max(b2Urls.length, 1) * 16 * 1024,
    },
  ];
}

function getCaches(override?: CacheStorage): CacheStorage | null {
  if (override) return override;
  return typeof caches !== "undefined" ? caches : null;
}

export async function inspectOfflinePacks(
  packs: OfflinePack[],
  cacheStorage?: CacheStorage,
): Promise<OfflinePackStatus[]> {
  const cs = getCaches(cacheStorage);
  if (!cs) {
    return packs.map((p) => ({ id: p.id, total: p.urls.length, cached: 0, bytes: 0, ready: false }));
  }
  const cache = await cs.open(OFFLINE_MEDIA_CACHE);
  const keys = await cache.keys();
  const keySet = new Set(keys.map((r) => r.url.split("#")[0]));
  const out: OfflinePackStatus[] = [];
  for (const p of packs) {
    let cached = 0;
    let bytes = 0;
    for (const u of p.urls) {
      if (!keySet.has(u)) continue;
      cached++;
      const res = await cache.match(u, { ignoreVary: true }).catch(() => undefined);
      const lenHeader = res?.headers.get("content-length");
      const n = lenHeader ? Number(lenHeader) : 0;
      if (Number.isFinite(n) && n > 0) bytes += n;
    }
    out.push({
      id: p.id,
      total: p.urls.length,
      cached,
      bytes,
      ready: p.urls.length > 0 && cached === p.urls.length,
    });
  }
  return out;
}

export async function downloadOfflinePack(
  pack: OfflinePack,
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: OfflineProgress) => void;
    concurrency?: number;
    cacheStorage?: CacheStorage;
    fetchImpl?: typeof fetch;
    sameOrigin?: string;
  } = {},
): Promise<{ total: number; cached: number; skipped: number; bytesAdded: number }> {
  const cs = getCaches(opts.cacheStorage);
  if (!cs) throw new Error("当前浏览器不支持离线 CacheStorage");
  const fetcher = opts.fetchImpl ?? fetch;
  const sameOrigin = opts.sameOrigin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const concurrency = Math.max(1, Math.min(8, opts.concurrency ?? 4));

  const cache = await cs.open(OFFLINE_MEDIA_CACHE);
  const existingKeys = new Set((await cache.keys()).map((r) => r.url.split("#")[0]));

  const todo: string[] = [];
  let skipped = 0;
  for (const u of pack.urls) {
    if (existingKeys.has(u)) skipped++;
    else todo.push(u);
  }

  let done = skipped;
  let bytesAdded = 0;
  let failed = 0;
  opts.onProgress?.({ done, total: pack.urls.length, skipped, bytesAdded });

  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      if (opts.signal?.aborted) return;
      const idx = cursor++;
      const url = todo[idx];
      try {
        let mode: RequestMode = "same-origin";
        try {
          mode = new URL(url, sameOrigin).origin === sameOrigin ? "same-origin" : "cors";
        } catch {
          mode = "cors";
        }
        const res = await fetcher(url, { mode, cache: "no-store", signal: opts.signal });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || ct.includes("text/html")) {
          failed++;
        } else {
          const len = Number(res.headers.get("content-length") || "0");
          const cloneForLen = Number.isFinite(len) && len > 0 ? null : res.clone();
          await cache.put(url, res);
          if (Number.isFinite(len) && len > 0) bytesAdded += len;
          else if (cloneForLen) bytesAdded += (await cloneForLen.arrayBuffer()).byteLength;
        }
      } catch (err) {
        if (opts.signal?.aborted || (err as Error)?.name === "AbortError") throw err;
        failed++;
      } finally {
        done++;
        opts.onProgress?.({ done: Math.min(done, pack.urls.length), total: pack.urls.length, skipped, bytesAdded });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, todo.length)) }, worker));
  if (opts.signal?.aborted) {
    const e = new Error("下载已取消");
    e.name = "AbortError";
    throw e;
  }
  if (failed > 0) {
    throw new Error(`部分文件下载失败（失败 ${failed} 个），可再次点击续传`);
  }
  return { total: pack.urls.length, cached: pack.urls.length, skipped, bytesAdded };
}

export async function removeOfflinePack(pack: OfflinePack, cacheStorage?: CacheStorage): Promise<number> {
  const cs = getCaches(cacheStorage);
  if (!cs) return 0;
  const cache = await cs.open(OFFLINE_MEDIA_CACHE);
  let removed = 0;
  for (const u of pack.urls) {
    if (await cache.delete(u, { ignoreVary: true })) removed++;
  }
  return removed;
}

export async function clearAllOfflineMedia(cacheStorage?: CacheStorage): Promise<void> {
  const cs = getCaches(cacheStorage);
  if (!cs) return;
  await cs.delete(OFFLINE_MEDIA_CACHE);
  await cs.delete(SW_MEDIA_CACHE);
}

export async function readStorageEstimate(): Promise<StorageStats> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { supported: false, usage: 0, quota: 0, persisted: null };
  }
  try {
    const est = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted().catch(() => null) : null;
    return {
      supported: true,
      usage: est.usage ?? 0,
      quota: est.quota ?? 0,
      persisted,
    };
  } catch {
    return { supported: false, usage: 0, quota: 0, persisted: null };
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
