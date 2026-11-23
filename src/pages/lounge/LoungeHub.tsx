import {
  BookOpen,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileUp,
  Film,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseBookFile } from "../../lib/epub";
import { LOUNGE_BOOKS, RECOMMENDED_PRIVATE_BOOKS } from "../../lib/lounge-books";
import { LOUNGE_MICRO_READS, MICRO_READ_CATEGORIES } from "../../lib/lounge-reads";
import type {
  EnergyTier,
  LocalLoungeVideoMeta,
  LoungeBookMeta,
  LoungeShelf,
  MicroReadCategory,
  StoredUserBook,
} from "../../lib/lounge-types";
import { CURATED_YOUTUBE_VIDEOS, OPEN_SAMPLE_VIDEOS } from "../../lib/lounge-videos";
import { formatBytes } from "../../lib/offline-packs";
import { go } from "../../lib/router";
import { AMBIENCE } from "../../lib/sound";
import {
  deleteLocalLoungeVideo,
  deleteLoungeClip,
  deleteUserBook,
  latestLoungeResume,
  listLocalLoungeVideos,
  listUserBooks,
  saveLocalLoungeVideo,
  saveUserBook,
} from "../../store/lounge";
import { useStoreShallow } from "../../store/store";
import { confirmAction } from "../../ui/ConfirmSheet";
import { toast } from "../../ui/Toast";
import { OFFLINE_MEDIA_CACHE } from "../listening/useOfflineMedia";

const ENERGY_FILTERS: readonly { id: "all" | EnergyTier; label: string }[] = [
  { id: "all", label: "全部" },
  { id: 1, label: "🔋 5分钟无脑回血" },
  { id: 2, label: "🔋🔋 15分钟沉浸追更" },
  { id: 3, label: "🔋🔋🔋 原生语料精学" },
];

const ENERGY_BADGE: Record<EnergyTier, string> = {
  1: "🔋 轻松回血",
  2: "🔋🔋 沉浸追更",
  3: "🔋🔋🔋 原生精学",
};

function resolveBookAssetUrls(book: LoungeBookMeta): string[] {
  if (typeof window === "undefined") return [];
  const base = import.meta.env.BASE_URL || "/";
  const urls: string[] = [];
  for (const ch of book.chapters) {
    const rawPath = ch.path || `materials/books/${book.id}/${ch.id}.json`;
    const rel = `${base}${rawPath.replace(/^\//, "")}`;
    try {
      const u = new URL(rel, window.location.href);
      u.hash = "";
      urls.push(u.href);
    } catch {
      /* ignore malformed url */
    }
    if (ch.audioUrl && !/^https?:\/\//i.test(ch.audioUrl)) {
      try {
        const au = new URL(`${base}${ch.audioUrl.replace(/^\//, "")}`, window.location.href);
        au.hash = "";
        urls.push(au.href);
      } catch {
        /* ignore */
      }
    }
  }
  return urls;
}

export function LoungeHub({ initialShelf }: { initialShelf?: LoungeShelf }) {
  const [shelf, setShelf] = useState<LoungeShelf>(initialShelf ?? "books");
  const [energy, setEnergy] = useState<"all" | EnergyTier>("all");
  const [readCat, setReadCat] = useState<"all" | MicroReadCategory>("all");

  const [userBooks, setUserBooks] = useState<StoredUserBook[]>([]);
  const [importingBook, setImportingBook] = useState(false);

  const [localVideos, setLocalVideos] = useState<LocalLoungeVideoMeta[]>([]);
  const [vidTitle, setVidTitle] = useState("");
  const [vidFile, setVidFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [importingVid, setImportingVid] = useState(false);

  const [cachedBookIds, setCachedBookIds] = useState<Set<string>>(() => new Set());
  const [cachingBookId, setCachingBookId] = useState<string | null>(null);

  useEffect(() => {
    if (initialShelf) setShelf(initialShelf);
  }, [initialShelf]);

  const progressSlice = useStoreShallow((s) => ({
    bookProgress: s.progress.bookProgress,
    mediaProgress: s.progress.mediaProgress,
    loungeClips: s.progress.loungeClips,
    loungeDays: s.progress.loungeDays,
  }));

  const resume = useMemo(() => latestLoungeResume(progressSlice), [progressSlice]);
  const clips = progressSlice.loungeClips ?? [];

  const refreshIdbLists = useCallback(async () => {
    const [books, vids] = await Promise.all([
      listUserBooks().catch(() => []),
      listLocalLoungeVideos().catch(() => []),
    ]);
    setUserBooks(books);
    setLocalVideos(vids);
  }, []);

  const syncBookCaches = useCallback(async () => {
    if (typeof caches === "undefined") return;
    try {
      const cache = await caches.open(OFFLINE_MEDIA_CACHE);
      const keys = new Set((await cache.keys()).map((r) => r.url.split("#")[0]));
      const next = new Set<string>();
      for (const b of LOUNGE_BOOKS) {
        const urls = resolveBookAssetUrls(b);
        if (urls.length > 0 && urls.every((u) => keys.has(u))) {
          next.add(b.id);
        }
      }
      setCachedBookIds(next);
    } catch {
      /* CacheStorage unavailable */
    }
  }, []);

  useEffect(() => {
    void refreshIdbLists();
    void syncBookCaches();
  }, [refreshIdbLists, syncBookCaches]);

  const switchShelf = (next: LoungeShelf) => {
    setShelf(next);
    go({ page: "lounge", shelf: next }, null, true);
  };

  const toggleBookCache = async (book: LoungeBookMeta) => {
    if (typeof caches === "undefined") {
      toast("当前浏览器环境不支持离线 CacheStorage", "warn");
      return;
    }
    const urls = resolveBookAssetUrls(book);
    if (!urls.length) return;
    setCachingBookId(book.id);
    try {
      const cache = await caches.open(OFFLINE_MEDIA_CACHE);
      if (cachedBookIds.has(book.id)) {
        await Promise.all(urls.map((u) => cache.delete(u)));
        await syncBookCaches();
        toast(`已清理《${book.titleZh}》离线缓存`);
      } else {
        for (const u of urls) {
          const res = await fetch(u, { cache: "no-store" });
          if (!res.ok) throw new Error(`章节下载失败 (${res.status})`);
          await cache.put(u, res);
        }
        await syncBookCaches();
        toast(`《${book.titleZh}》全书已缓存至离线空间`, "ok");
      }
    } catch (e) {
      toast((e as Error).message || "离线缓存失败", "warn");
    } finally {
      setCachingBookId(null);
    }
  };

  const handleBookFileUpload = async (file: File | undefined) => {
    if (!file || importingBook) return;
    setImportingBook(true);
    try {
      const parsed = await parseBookFile(file);
      const ok = await saveUserBook(parsed);
      if (!ok && typeof indexedDB !== "undefined") {
        throw new Error("浏览器拒绝写入本地存储，请检查可用空间");
      }
      await refreshIdbLists();
      toast(`已导入《${parsed.title}》（共 ${parsed.chapters.length} 章）`, "ok");
      go({ page: "lounge", shelf: "books", item: parsed.id });
    } catch (e) {
      toast((e as Error).message || "电子书解析失败", "warn");
    } finally {
      setImportingBook(false);
    }
  };

  const handleDeleteUserBook = async (book: StoredUserBook) => {
    const ok = await confirmAction({
      title: `删除本地导入的《${book.title}》？`,
      message: "将从浏览器 IndexedDB 移除该书正文，无法撤销。",
      confirmLabel: "确认删除",
      danger: true,
    });
    if (!ok) return;
    await deleteUserBook(book.id);
    await refreshIdbLists();
    toast(`已删除《${book.title}》`);
  };

  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vidFile || importingVid) return;
    setImportingVid(true);
    try {
      const meta = await saveLocalLoungeVideo({
        title: vidTitle.trim() || undefined,
        videoFile: vidFile,
        subFile,
      });
      setVidTitle("");
      setVidFile(null);
      setSubFile(null);
      await refreshIdbLists();
      toast(`已导入本地视频「${meta.title}」`, "ok");
    } catch (err) {
      toast((err as Error).message || "视频导入失败", "warn");
    } finally {
      setImportingVid(false);
    }
  };

  const handleDeleteLocalVideo = async (vid: LocalLoungeVideoMeta) => {
    const ok = await confirmAction({
      title: `删除本地视频「${vid.title}」？`,
      message: "将一并移除保存在 IndexedDB 中的视频与外挂字幕。",
      confirmLabel: "确认删除",
      danger: true,
    });
    if (!ok) return;
    await deleteLocalLoungeVideo(vid.id);
    await refreshIdbLists();
    toast(`已删除「${vid.title}」`);
  };

  const copyClip = async (fr: string, zh: string, source: string) => {
    const text = zh ? `${fr}\n${zh} —— ${source}` : `${fr} —— ${source}`;
    try {
      await navigator.clipboard?.writeText(text);
      toast("已复制到剪贴板", "ok");
    } catch {
      toast("当前环境无法自动复制，请长按选择文本", "warn");
    }
  };

  const filteredBooks = useMemo(
    () => LOUNGE_BOOKS.filter((b) => energy === "all" || b.energy === energy),
    [energy],
  );
  const filteredPrivateBooks = useMemo(
    () => RECOMMENDED_PRIVATE_BOOKS.filter((b) => energy === "all" || b.energy === energy),
    [energy],
  );
  const filteredReads = useMemo(
    () =>
      LOUNGE_MICRO_READS.filter(
        (r) =>
          (energy === "all" || r.energy === energy) &&
          (readCat === "all" || r.category === readCat),
      ),
    [energy, readCat],
  );
  const filteredOpenVideos = useMemo(
    () => OPEN_SAMPLE_VIDEOS.filter((v) => energy === "all" || v.energy === energy),
    [energy],
  );
  const filteredYoutubeVideos = useMemo(
    () => CURATED_YOUTUBE_VIDEOS.filter((v) => energy === "all" || v.energy === energy),
    [energy],
  );

  const ambienceLabel = (id?: string) => AMBIENCE.find((a) => a.id === id)?.label ?? id;

  return (
    <>
      <header className="lounge-hero">
        <div className="lounge-hero-top">
          <p className="eyebrow">漫游 · 书影音馆 · Flânerie</p>
          <span className="lounge-badge">零打分 · 不催复习 · 随时停下</span>
        </div>
        <h1>累了的时候，换一种方式待在法语里。</h1>
        <p className="lounge-hero-lede">
          翻两页双语公版小说、读一篇配着雨声的睡前小品，或者看支开源动画与法语短片。默认「躺平放松」不给任何词划线；想顺手攒表达时，随时一键切到「顺手精学」。
        </p>
      </header>

      {resume && (
        <section className="lounge-resume" aria-label="继续上次漫游">
          <div className="lounge-resume-info">
            <span className="eyebrow">上次停在这里</span>
            <b>{resume.title}</b>
            <small>{resume.label}</small>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              go({
                page: "lounge",
                shelf: resume.shelf,
                item: resume.item,
                ...(resume.ch !== undefined ? { ch: String(resume.ch) } : {}),
              })
            }
          >
            接着上次继续 →
          </button>
        </section>
      )}

      <section className="lounge-filters" aria-label="精力状态与内容分区">
        <div className="lounge-energy-bar" role="group" aria-label="按当前精力筛选">
          {ENERGY_FILTERS.map((f) => (
            <button
              key={String(f.id)}
              type="button"
              className={`lounge-pill ${energy === f.id ? "is-on" : ""}`}
              aria-pressed={energy === f.id}
              onClick={() => setEnergy(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="lounge-shelves" role="tablist" aria-label="漫游馆书架切换">
          <button
            type="button"
            role="tab"
            aria-selected={shelf === "books"}
            className={`lounge-shelf-tab ${shelf === "books" ? "is-on" : ""}`}
            onClick={() => switchShelf("books")}
          >
            📖 书籍轻读
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={shelf === "reads"}
            className={`lounge-shelf-tab ${shelf === "reads" ? "is-on" : ""}`}
            onClick={() => switchShelf("reads")}
          >
            ☕ 睡前摸鱼小品
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={shelf === "videos"}
            className={`lounge-shelf-tab ${shelf === "videos" ? "is-on" : ""}`}
            onClick={() => switchShelf("videos")}
          >
            🎬 视频漫游
          </button>
        </div>
      </section>

      {/* ==================== SHELF 1: BOOKS ==================== */}
      {shelf === "books" && (
        <div className="lounge-block">
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">开箱即读 · 中法双语公版精选</p>
              <h2>精选法语名家短篇与章节（{filteredBooks.length} 部）</h2>
            </div>
          </div>

          {filteredBooks.length === 0 ? (
            <p className="muted">当前精力档位下暂无匹配的内置书籍，试试切换到「全部」。</p>
          ) : (
            <div className="lounge-grid">
              {filteredBooks.map((book) => {
                const bp = progressSlice.bookProgress?.[book.id];
                const isCached = cachedBookIds.has(book.id);
                const isBusy = cachingBookId === book.id;
                const overallRatio = bp
                  ? bp.done
                    ? 1
                    : Math.min(1, (bp.ch + bp.ratio) / Math.max(1, book.chapters.length))
                  : 0;
                return (
                  <article key={book.id} className="lounge-card is-book">
                    <div className="lounge-card-body">
                      <div className="lounge-badges">
                        <span className="lounge-badge">{book.level}</span>
                        <span className="lounge-badge is-energy">{ENERGY_BADGE[book.energy]}</span>
                        {bp?.done && (
                          <span className="lounge-badge is-done">
                            <Check size={12} /> 已读完
                          </span>
                        )}
                        {book.moodTags.map((tag) => (
                          <span key={tag} className="lounge-badge">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="lounge-card-title" lang="fr">
                        {book.title}
                      </h3>
                      <p className="lounge-card-sub">
                        {book.titleZh} · {book.author} ({book.year}) · {book.chapters.length} 章
                      </p>
                      <p className="lounge-card-desc">{book.summaryZh}</p>
                      <p className="lounge-card-note">{book.licenseNote}</p>
                      {bp && (
                        <div className="lounge-prog">
                          <div className="lounge-prog-track" aria-hidden="true">
                            <span style={{ width: `${Math.round(overallRatio * 100)}%` }} />
                          </div>
                          <span>
                            {bp.done
                              ? "全书已读完"
                              : `读至第 ${bp.ch + 1}/${book.chapters.length} 章`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="lounge-card-foot">
                      <div className="lounge-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            go({
                              page: "lounge",
                              shelf: "books",
                              item: book.id,
                              ...(bp && !bp.done ? { ch: String(bp.ch) } : {}),
                            })
                          }
                        >
                          <BookOpen size={15} />{" "}
                          {bp ? (bp.done ? "重温本书" : "继续阅读") : "开始阅读"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={isBusy}
                          aria-pressed={isCached}
                          onClick={() => void toggleBookCache(book)}
                        >
                          {isBusy ? (
                            "缓存中…"
                          ) : isCached ? (
                            <>
                              <Check size={14} /> 已离线缓存
                            </>
                          ) : (
                            <>
                              <Download size={14} /> 离线缓存
                            </>
                          )}
                        </button>
                      </div>
                      {book.librivoxUrl && (
                        <a
                          className="link small"
                          href={book.librivoxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          LibriVox 有声书 <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* User Imported Books */}
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">私有书库 · 浏览器本地解析</p>
              <h2>我导入的电子书（{userBooks.length} 本）</h2>
            </div>
            <label className={`btn btn-primary btn-sm ${importingBook ? "is-disabled" : ""}`}>
              <FileUp size={15} /> {importingBook ? "解析中…" : "导入 .epub / .txt"}
              <input
                type="file"
                accept=".epub,.txt,.md,application/epub+zip,text/plain"
                hidden
                disabled={importingBook}
                onChange={(e) => {
                  void handleBookFileUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {userBooks.length === 0 ? (
            <div className="lounge-upload-box">
              <p className="lounge-card-desc">
                支持零依赖本地解析无 DRM 的法语 <code>.epub</code> 或 <code>.txt</code> 电子书（保存在这台设备的 IndexedDB，绝不上传服务器），自动按章节切分并支持点词速查与 AI 按需译段。
              </p>
            </div>
          ) : (
            <div className="lounge-grid">
              {userBooks.map((ub) => {
                const bp = progressSlice.bookProgress?.[ub.id];
                return (
                  <article key={ub.id} className="lounge-card is-book">
                    <div className="lounge-card-body">
                      <div className="lounge-badges">
                        <span className="lounge-badge">{ub.format.toUpperCase()}</span>
                        <span className="lounge-badge">{ub.chapters.length} 章</span>
                        <span className="lounge-badge">{formatBytes(ub.byteSize)}</span>
                      </div>
                      <h3 className="lounge-card-title" lang="fr">
                        {ub.title}
                      </h3>
                      {ub.author && <p className="lounge-card-sub">{ub.author}</p>}
                    </div>
                    <div className="lounge-card-foot">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          go({
                            page: "lounge",
                            shelf: "books",
                            item: ub.id,
                            ...(bp && !bp.done ? { ch: String(bp.ch) } : {}),
                          })
                        }
                      >
                        <BookOpen size={15} /> {bp && !bp.done ? `续读第 ${bp.ch + 1} 章` : "打开阅读"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`删除 ${ub.title}`}
                        onClick={() => void handleDeleteUserBook(ub)}
                      >
                        <Trash2 size={14} /> 删除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* 10 Recommended Private Books */}
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">延伸书单 · 自备正版电子书导读</p>
              <h2>法语学习者口碑原版书推荐（{filteredPrivateBooks.length} 部）</h2>
            </div>
          </div>

          <div className="lounge-grid">
            {filteredPrivateBooks.map((rec) => (
              <article key={rec.id} className="lounge-card is-private">
                <div className="lounge-card-body">
                  <div className="lounge-badges">
                    <span className="lounge-badge">{rec.level}</span>
                    <span className="lounge-badge is-overlap">
                      核心词覆盖 {rec.atlasOverlapPct}%
                    </span>
                    <span className="lounge-badge is-energy">{ENERGY_BADGE[rec.energy]}</span>
                    {rec.tags.map((t) => (
                      <span key={t} className="lounge-badge">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h3 className="lounge-card-title" lang="fr">
                    {rec.title}
                  </h3>
                  <p className="lounge-card-sub">
                    {rec.titleZh} · {rec.author}
                  </p>
                  <p className="lounge-card-desc">{rec.whyZh}</p>
                  <p className="lounge-card-note">{rec.copyrightNoteZh}</p>
                </div>
                <div className="lounge-card-foot">
                  <label className="btn btn-ghost btn-sm">
                    <Upload size={14} /> 导入自备 .epub
                    <input
                      type="file"
                      accept=".epub,.txt,.md,application/epub+zip,text/plain"
                      hidden
                      disabled={importingBook}
                      onChange={(e) => {
                        void handleBookFileUpload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ==================== SHELF 2: MICRO-READS ==================== */}
      {shelf === "reads" && (
        <div className="lounge-block">
          <div className="lounge-cat-bar" role="group" aria-label="小品分类筛选">
            <button
              type="button"
              className={`lounge-pill ${readCat === "all" ? "is-on" : ""}`}
              aria-pressed={readCat === "all"}
              onClick={() => setReadCat("all")}
            >
              全部 ({LOUNGE_MICRO_READS.length})
            </button>
            {MICRO_READ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`lounge-pill ${readCat === cat.id ? "is-on" : ""}`}
                aria-pressed={readCat === cat.id}
                onClick={() => setReadCat(cat.id)}
                title={cat.desc}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredReads.length === 0 ? (
            <p className="muted">当前筛选下没有小品，试试切换到「全部」或更低精力档位。</p>
          ) : (
            <div className="lounge-grid is-three">
              {filteredReads.map((item) => {
                const done = Boolean(progressSlice.mediaProgress?.[item.id]?.done);
                return (
                  <article key={item.id} className="lounge-card">
                    <div className="lounge-card-body">
                      <div className="lounge-badges">
                        <span className="lounge-badge">{item.level}</span>
                        <span className="lounge-badge">{item.minutes} 分钟</span>
                        {item.series && (
                          <span className="lounge-badge is-energy">
                            {item.series.titleZh} · 第 {item.series.ep}/{item.series.total} 集
                          </span>
                        )}
                        {item.recommendedAmbience && (
                          <span className="lounge-badge is-ambience">
                            🎧 宜配：{ambienceLabel(item.recommendedAmbience)}
                          </span>
                        )}
                        {done && (
                          <span className="lounge-badge is-done">
                            <Check size={12} /> 已读
                          </span>
                        )}
                      </div>
                      <h3 className="lounge-card-title" lang="fr">
                        {item.title}
                      </h3>
                      <p className="lounge-card-sub">{item.titleZh}</p>
                      <p className="lounge-card-desc" lang="fr">
                        {item.fr[0]?.slice(0, 110)}
                        {(item.fr[0]?.length ?? 0) > 110 ? "…" : ""}
                      </p>
                      <p className="lounge-card-note">{item.authorNote}</p>
                    </div>
                    <div className="lounge-card-foot">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => go({ page: "lounge", shelf: "reads", item: item.id })}
                      >
                        <Sparkles size={14} /> {done ? "再读一遍" : "读这篇 →"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== SHELF 3: VIDEOS ==================== */}
      {shelf === "videos" && (
        <div className="lounge-block">
          {/* Track A */}
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">Track A · 开源与公版直连短片</p>
              <h2>内置双语交互字幕影院（{filteredOpenVideos.length} 部）</h2>
            </div>
          </div>

          {filteredOpenVideos.length === 0 ? (
            <p className="muted">当前精力档位下暂无开源短片。</p>
          ) : (
            <div className="lounge-grid">
              {filteredOpenVideos.map((vid) => {
                const mp = progressSlice.mediaProgress?.[vid.id];
                return (
                  <article key={vid.id} className="lounge-card">
                    <div className="lounge-card-body">
                      <div className="lounge-badges">
                        <span className="lounge-badge">{vid.level}</span>
                        <span className="lounge-badge">{vid.durationLabel}</span>
                        <span className="lounge-badge is-energy">{ENERGY_BADGE[vid.energy]}</span>
                        <span className="lounge-badge">{vid.license}</span>
                        {vid.ttsNarration && (
                          <span className="lounge-badge is-ambience">支持法语旁白跟读</span>
                        )}
                        {mp?.done && (
                          <span className="lounge-badge is-done">
                            <Check size={12} /> 看过
                          </span>
                        )}
                      </div>
                      <h3 className="lounge-card-title" lang="fr">
                        {vid.title}
                      </h3>
                      <p className="lounge-card-sub">
                        {vid.titleZh} · {vid.creator}
                      </p>
                      <p className="lounge-card-desc">{vid.summaryZh}</p>
                    </div>
                    <div className="lounge-card-foot">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => go({ page: "lounge", shelf: "videos", item: vid.id })}
                      >
                        <Film size={15} /> 进入放映厅 →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Track B */}
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">Track B · 精选法语频道导览 (YouTube Privacy-Enhanced)</p>
              <h2>原生法语播客、科普与街头文化（{filteredYoutubeVideos.length} 支）</h2>
            </div>
          </div>

          {filteredYoutubeVideos.length === 0 ? (
            <p className="muted">当前精力档位下暂无精选频道视频。</p>
          ) : (
            <div className="lounge-grid">
              {filteredYoutubeVideos.map((yt) => (
                <article key={yt.id} className="lounge-card">
                  <div className="lounge-card-body">
                    <div className="lounge-badges">
                      <span className="lounge-badge">{yt.level}</span>
                      <span className="lounge-badge">{yt.durationLabel}</span>
                      <span className="lounge-badge is-energy">{ENERGY_BADGE[yt.energy]}</span>
                      <span className="lounge-badge">{yt.channel}</span>
                      {yt.hasBurnedInSubs && (
                        <span className="lounge-badge is-ambience">自带硬字幕/法语CC</span>
                      )}
                    </div>
                    <h3 className="lounge-card-title" lang="fr">
                      {yt.title}
                    </h3>
                    <p className="lounge-card-sub">{yt.titleZh}</p>
                    <p className="lounge-card-desc">{yt.summaryZh}</p>
                  </div>
                  <div className="lounge-card-foot">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => go({ page: "lounge", shelf: "videos", item: yt.id })}
                    >
                      <Film size={15} /> 打开导览与实例卡 →
                    </button>
                    <a
                      className="link small"
                      href={yt.fallbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      YouTube 原站 <ExternalLink size={12} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Track C */}
          <div className="lounge-block-head">
            <div>
              <p className="eyebrow">Track C · 本地私人影院 (IndexedDB)</p>
              <h2>导入本地 .mp4 / .webm 与双语字幕（{localVideos.length} 部）</h2>
            </div>
          </div>

          <form className="lounge-upload-box" onSubmit={(e) => void handleVideoUpload(e)}>
            <div className="lounge-upload-fields">
              <input
                type="text"
                className="lounge-input"
                placeholder="视频标题（选填）"
                value={vidTitle}
                onChange={(e) => setVidTitle(e.target.value)}
                aria-label="本地视频标题"
              />
              <label className="btn btn-ghost btn-sm">
                <Film size={14} /> {vidFile ? vidFile.name : "选择 .mp4 / .webm 视频"}
                <input
                  type="file"
                  accept="video/mp4,video/webm,.mp4,.webm,.m4v"
                  hidden
                  onChange={(e) => setVidFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="btn btn-ghost btn-sm">
                <FileUp size={14} /> {subFile ? subFile.name : "可选：挂载 .srt / .vtt 字幕"}
                <input
                  type="file"
                  accept=".srt,.vtt,text/vtt,application/x-subrip"
                  hidden
                  onChange={(e) => setSubFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!vidFile || importingVid}
            >
              {importingVid ? "保存中…" : "保存至本地影院"}
            </button>
          </form>

          {localVideos.length > 0 && (
            <div className="lounge-grid">
              {localVideos.map((lv) => (
                <article key={lv.id} className="lounge-card">
                  <div className="lounge-card-body">
                    <div className="lounge-badges">
                      <span className="lounge-badge">{formatBytes(lv.videoBytes)}</span>
                      <span className="lounge-badge">
                        {lv.hasSubtitles ? `外挂字幕 ${lv.cueCount} 句` : "无外挂字幕"}
                      </span>
                    </div>
                    <h3 className="lounge-card-title">{lv.title}</h3>
                  </div>
                  <div className="lounge-card-foot">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => go({ page: "lounge", shelf: "videos", item: lv.id })}
                    >
                      <Film size={15} /> 播放视频 →
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`删除 ${lv.title}`}
                      onClick={() => void handleDeleteLocalVideo(lv)}
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== SAVED CULTURAL CLIPS ==================== */}
      <section className="panel lounge-block" aria-label="文化实例笔记">
        <div className="lounge-block-head">
          <div>
            <p className="eyebrow">Carnet de flânerie · 随手摘录</p>
            <h2>我的文化实例笔记（{clips.length} 条）</h2>
          </div>
        </div>
        {clips.length === 0 ? (
          <p className="muted small">
            在漫游阅读或影院中遇到喜欢的地道法语表达，点一下「收进文化实例笔记」就会留在这里，写作文或练口语时随时翻看。
          </p>
        ) : (
          <ul className="lounge-clips-list">
            {clips.map((clip) => (
              <li key={clip.id} className="lounge-clip-item">
                <p className="lounge-clip-fr" lang="fr">
                  {clip.fr}
                </p>
                {clip.zh && <p className="lounge-clip-zh">{clip.zh}</p>}
                <div className="lounge-clip-meta">
                  <span>来源：{clip.source}</span>
                  <span className="lounge-card-actions">
                    <button
                      type="button"
                      className="lounge-para-btn"
                      onClick={() => void copyClip(clip.fr, clip.zh, clip.source)}
                    >
                      <ClipboardCopy size={12} /> 复制
                    </button>
                    <button
                      type="button"
                      className="lounge-para-btn"
                      aria-label={`删除摘录 ${clip.fr.slice(0, 20)}`}
                      onClick={() => deleteLoungeClip(clip.id)}
                    >
                      <Trash2 size={12} /> 删除
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
