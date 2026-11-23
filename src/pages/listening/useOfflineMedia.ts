import { useCallback, useEffect, useState } from "react";
import { resolveMaterialUrl } from "../../lib/listening";
import { isAllowedOfflineOrigin } from "../../lib/media";
import { toast } from "../../ui/Toast";

export const STEPS = ["盲听", "答题", "逐句听写", "跟读"] as const;
export type ExamPhase = "idle" | "prep" | "play1" | "gap" | "play2" | "review";

export const PHASE_LABEL: Record<ExamPhase, string> = {
  idle: "准备开始考场两遍限时盲听",
  prep: "读题准备（30 秒）",
  play1: "第一遍播音中（不可回放）",
  gap: "整理笔记间隔（30 秒）",
  play2: "第二遍播音中（不可回放）",
  review: "两遍播音结束，请进入「答题」核对得分",
};

export const day = (ms: number) => new Date(ms).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
export const baseUrl = () => import.meta.env.BASE_URL || "/";
export const OFFLINE_MEDIA_CACHE = "atlas-offline-media";

export function resolveOfflineMediaUrl(rawUrl: string): string | null {
  if (!rawUrl || /^idb:/i.test(rawUrl) || typeof window === "undefined") return null;
  if (!/^materials\//i.test(rawUrl) && !/\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v)(\?|$)/i.test(rawUrl)) return null;
  try {
    const resolved = new URL(resolveMaterialUrl(rawUrl, baseUrl()), window.location.href);
    if (!isAllowedOfflineOrigin(resolved, window.location.origin)) return null;
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

export interface OfflineMediaState {
  has: (rawUrl: string) => boolean;
  busy: string | null;
  download: (rawUrl: string, extraUrl?: string) => Promise<void>;
  remove: (rawUrl: string) => Promise<void>;
}

export function useOfflineMedia(): OfflineMediaState {
  const [cached, setCached] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (typeof caches === "undefined") return;
    try {
      const cache = await caches.open(OFFLINE_MEDIA_CACHE);
      const keys = await cache.keys();
      setCached(new Set(keys.map((req) => req.url.split("#")[0])));
    } catch {
      /* CacheStorage unavailable */
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  const has = useCallback(
    (rawUrl: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      return abs ? cached.has(abs) : false;
    },
    [cached],
  );

  const download = useCallback(
    async (rawUrl: string, extraUrl?: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      if (!abs) return toast("当前音频来源不支持离线缓存", "warn");
      if (typeof caches === "undefined") return toast("当前浏览器环境不支持离线 CacheStorage", "warn");
      setBusy(rawUrl);
      try {
        const res = await fetch(abs, {
          mode: abs.startsWith(window.location.origin) ? "same-origin" : "cors",
          cache: "no-store",
        });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || ct.includes("text/html")) throw new Error("音频下载失败");
        const cache = await caches.open(OFFLINE_MEDIA_CACHE);
        await cache.put(abs, res);
        if (extraUrl && /^materials\//i.test(extraUrl) && typeof window !== "undefined") {
          const extraAbs = new URL(resolveMaterialUrl(extraUrl, baseUrl()), window.location.href).href.split("#")[0];
          const extraRes = await fetch(extraAbs, { cache: "no-store" }).catch(() => null);
          if (extraRes?.ok) await cache.put(extraAbs, extraRes);
        }
        const rfiMatch = rawUrl.match(/^materials\/rfi\/([a-z0-9-]+)\.mp3$/i);
        if (rfiMatch && typeof window !== "undefined") {
          const segAbs = new URL(resolveMaterialUrl(`materials/rfi/${rfiMatch[1]}.segments.json`, baseUrl()), window.location.href).href.split("#")[0];
          const segRes = await fetch(segAbs, { cache: "no-store" }).catch(() => null);
          if (segRes?.ok) await cache.put(segAbs, segRes);
        }
        await sync();
        toast("已下载到离线缓存，断网也可播放");
      } catch (e) {
        toast((e as Error).message || "下载到离线失败，请检查网络连接", "warn");
      } finally {
        setBusy((cur) => (cur === rawUrl ? null : cur));
      }
    },
    [sync],
  );

  const remove = useCallback(
    async (rawUrl: string) => {
      const abs = resolveOfflineMediaUrl(rawUrl);
      if (!abs || typeof caches === "undefined") return;
      setBusy(rawUrl);
      try {
        const cache = await caches.open(OFFLINE_MEDIA_CACHE);
        await cache.delete(abs);
        await sync();
        toast("已从离线缓存移除");
      } catch {
        toast("移除离线缓存失败", "warn");
      } finally {
        setBusy((cur) => (cur === rawUrl ? null : cur));
      }
    },
    [sync],
  );

  return { has, busy, download, remove };
}
