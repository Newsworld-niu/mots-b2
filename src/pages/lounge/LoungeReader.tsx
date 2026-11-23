import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  BookOpenText,
  Check,
  Clock,
  CloudRain,
  Coffee,
  Flame,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { aiJson } from "../../ai/clients";
import { ready, useAiConfig } from "../../ai/config";
import { useAtlas } from "../../atlas/context";
import { play, stopAudio } from "../../lib/audio";
import { joinGlosses, lookupDict } from "../../lib/dict";
import { LOUNGE_BOOKS, loadBookChapter } from "../../lib/lounge-books";
import { LOUNGE_MICRO_READS } from "../../lib/lounge-reads";
import type {
  BookChapterData,
  DialogueLine,
  StoredUserBook,
} from "../../lib/lounge-types";
import {
  annotate,
  type ReadSentence,
  type ReadToken,
  type WordStatus,
} from "../../lib/reader";
import { go, href, openWord } from "../../lib/router";
import { AMBIENCE, cue, suspendAmbience, type AmbienceId } from "../../lib/sound";
import { addPicked, createDeck, MAX_SOURCE_SENTENCE } from "../../store/decks";
import {
  getUserBook,
  markBookChapterDone,
  markMicroReadDone,
  saveLoungeClip,
  setLoungeMode,
  updateBookProgress,
  updateMediaProgress,
} from "../../store/lounge";
import { isMastered, type CardState } from "../../store/srs";
import { store, useStore } from "../../store/store";
import { toast } from "../../ui/Toast";
import { WordPopup } from "../../ui/WordPopup";

const LOUNGE_DECK = "阅读生词";

const liveStatus = (t: ReadToken, cards: Record<string, CardState>): WordStatus =>
  t.status !== "new" || !t.id
    ? t.status
    : isMastered(cards[t.id])
      ? "known"
      : cards[t.id]
        ? "learning"
        : "new";

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

interface PickedStudyWord {
  tok: ReadToken;
  sentence: string;
}

export function LoungeReader({
  kind,
  itemId,
  chapterParam,
}: {
  kind: "book" | "read";
  itemId: string;
  chapterParam?: string;
}) {
  const atlas = useAtlas();
  const ai = useAiConfig();
  const aiReady = ready.text(ai);
  const loungeMode = useStore((s) => s.settings.loungeMode) ?? "chill";
  const ambience = useStore((s) => s.settings.ambience);
  const voice = useStore((s) => s.settings.accent);
  const readDeck = useStore((s) => s.settings.readDeck);
  const cards = useStore((s) => s.progress.cards);
  const decks = useStore((s) => s.progress.decks) ?? [];
  const bookProg = useStore((s) => s.progress.bookProgress?.[itemId]);
  const mediaProg = useStore((s) => s.progress.mediaProgress?.[itemId]);

  const bundledBook = useMemo(
    () => (kind === "book" ? LOUNGE_BOOKS.find((b) => b.id === itemId) ?? null : null),
    [kind, itemId],
  );
  const microRead = useMemo(
    () => (kind === "read" ? LOUNGE_MICRO_READS.find((r) => r.id === itemId) ?? null : null),
    [kind, itemId],
  );

  const [userBook, setUserBook] = useState<StoredUserBook | null>(null);
  const [userBookLoading, setUserBookLoading] = useState(kind === "book" && !bundledBook);
  const [chapterData, setChapterData] = useState<BookChapterData | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterErr, setChapterErr] = useState<string | null>(null);

  const totalChapters = bundledBook
    ? bundledBook.chapters.length
    : userBook
      ? userBook.chapters.length
      : 1;

  const resolveInitialChapter = useCallback(
    (chapters: readonly { id: string }[], savedCh?: number) => {
      if (!chapters.length) return 0;
      if (chapterParam !== undefined) {
        const byId = chapters.findIndex((c) => c.id === chapterParam);
        if (byId >= 0) return byId;
        const asNum = Number.parseInt(chapterParam, 10);
        if (Number.isFinite(asNum) && asNum >= 0 && asNum < chapters.length) return asNum;
      }
      if (typeof savedCh === "number" && savedCh >= 0 && savedCh < chapters.length) {
        return savedCh;
      }
      return 0;
    },
    [chapterParam],
  );

  const [chIdx, setChIdx] = useState<number>(() =>
    bundledBook ? resolveInitialChapter(bundledBook.chapters, bookProg?.ch) : 0,
  );

  // Sync chIdx if chapterParam changes via route navigation
  useEffect(() => {
    const chapters = bundledBook?.chapters ?? userBook?.chapters;
    if (chapters?.length) {
      setChIdx(resolveInitialChapter(chapters, bookProg?.ch));
    }
  }, [chapterParam, bundledBook, userBook]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load user-imported book if not bundled
  useEffect(() => {
    if (kind !== "book" || bundledBook) {
      setUserBook(null);
      setUserBookLoading(false);
      return;
    }
    let alive = true;
    setUserBookLoading(true);
    void getUserBook(itemId)
      .then((ub) => {
        if (!alive) return;
        setUserBook(ub);
        if (ub?.chapters.length) {
          setChIdx(resolveInitialChapter(ub.chapters, bookProg?.ch));
        }
      })
      .finally(() => {
        if (alive) setUserBookLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, itemId, bundledBook]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load bundled chapter shard
  useEffect(() => {
    if (!bundledBook) {
      setChapterData(null);
      return;
    }
    const chMeta = bundledBook.chapters[chIdx] ?? bundledBook.chapters[0];
    if (!chMeta) return;
    let alive = true;
    setChapterLoading(true);
    setChapterErr(null);
    void loadBookChapter(bundledBook.id, chMeta.id)
      .then((data) => {
        if (alive) setChapterData(data);
      })
      .catch((e: Error) => {
        if (alive) setChapterErr(e.message || "章节加载失败");
      })
      .finally(() => {
        if (alive) setChapterLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bundledBook, chIdx]);

  // Record opening progress so Resume works immediately
  useEffect(() => {
    if (kind === "book") {
      const title = bundledBook?.titleZh || bundledBook?.title || userBook?.title;
      if (title) {
        updateBookProgress(itemId, {
          ch: chIdx,
          para: 0,
          ratio: bookProg?.ch === chIdx ? bookProg.ratio : 0.05,
          title,
        });
      }
    } else if (microRead && !mediaProg?.done) {
      updateMediaProgress(microRead.id, {
        pos: 0.2,
        dur: 1,
        title: `${microRead.title} · ${microRead.titleZh}`,
        shelf: "reads",
      });
    }
  }, [kind, itemId, chIdx, bundledBook, userBook, microRead]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bilingual & per-paragraph inline toggles
  const hasZh = kind === "read" ? Boolean(microRead?.zh?.length) : Boolean(bundledBook);
  const [bilingual, setBilingual] = useState(true);
  const [paraZhOpen, setParaZhOpen] = useState<Record<number, boolean>>({});
  const [aiZhMap, setAiZhMap] = useState<Record<number, string>>({});
  const [aiNoteMap, setAiNoteMap] = useState<Record<number, string>>({});
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [pollChoice, setPollChoice] = useState<number | null>(null);

  // Reset paragraph overrides on chapter / item switch
  useEffect(() => {
    setParaZhOpen({});
    setAiZhMap({});
    setAiNoteMap({});
    setPollChoice(null);
  }, [itemId, chIdx]);

  // Gentle Break Timer (10 / 15 / 20m)
  const [timerSec, setTimerSec] = useState<number | null>(null);
  const [breakAlert, setBreakAlert] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ttsRunRef = useRef(0);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (timerSec === null) return;
    if (timerSec <= 0) {
      setTimerSec(null);
      setBreakAlert(true);
      ttsRunRef.current++;
      stopAudio();
      setPlayingIdx(null);
      audioRef.current?.pause();
      void cue("twinkle");
      toast("小憩时间到 · 合上屏幕让眼睛歇一会儿吧 ✨", "ok");
      return;
    }
    const id = window.setTimeout(() => setTimerSec((s) => (s !== null ? s - 1 : null)), 1000);
    return () => window.clearTimeout(id);
  }, [timerSec]);

  useEffect(
    () => () => {
      ttsRunRef.current++;
      stopAudio();
      suspendAmbience(false);
    },
    [],
  );

  // Active French lines (either dialogue turns or prose paragraphs)
  const dialogueLines: DialogueLine[] | null =
    kind === "read" && microRead?.dialogue?.length ? microRead.dialogue : null;

  const frParagraphs: string[] = useMemo(() => {
    if (kind === "read") {
      if (dialogueLines) return dialogueLines.map((d) => d.fr);
      return microRead?.fr ?? [];
    }
    if (bundledBook) return chapterData?.fr ?? [];
    if (userBook) return userBook.chapters[chIdx]?.fr ?? [];
    return [];
  }, [kind, dialogueLines, microRead, bundledBook, chapterData, userBook, chIdx]);

  const zhParagraphs: string[] = useMemo(() => {
    if (kind === "read") {
      if (dialogueLines) return dialogueLines.map((d) => d.zh);
      return microRead?.zh ?? [];
    }
    if (bundledBook) return chapterData?.zh ?? [];
    return [];
  }, [kind, dialogueLines, microRead, bundledBook, chapterData]);

  const sourceLabel = useMemo(() => {
    if (kind === "read" && microRead) return `${microRead.title}（${microRead.titleZh}）`;
    if (bundledBook) {
      const ch = bundledBook.chapters[chIdx];
      return ch ? `《${bundledBook.titleZh}》· ${ch.titleZh}` : `《${bundledBook.titleZh}》`;
    }
    if (userBook) {
      const ch = userBook.chapters[chIdx];
      return ch ? `《${userBook.title}》· ${ch.title}` : `《${userBook.title}》`;
    }
    return "漫游馆";
  }, [kind, microRead, bundledBook, userBook, chIdx]);

  // Study Mode annotation on ONLY the active chapter / micro-read
  const [annotatedParas, setAnnotatedParas] = useState<ReadSentence[][] | null>(null);
  const [pickedWord, setPickedWord] = useState<PickedStudyWord | null>(null);

  useEffect(() => {
    setPickedWord(null);
    if (loungeMode !== "study" || !frParagraphs.length) {
      setAnnotatedParas(null);
      return;
    }
    let alive = true;
    void Promise.all(frParagraphs.map((p) => annotate(p, atlas, () => "new", lookupDict))).then(
      (results) => {
        if (!alive) return;
        setAnnotatedParas(results.map((block) => block.flat()));
      },
    );
    return () => {
      alive = false;
    };
  }, [loungeMode, frParagraphs, atlas]);

  const coloredParas = useMemo(
    () =>
      annotatedParas
        ? annotatedParas.map((sents) =>
            sents.map((s) => ({
              ...s,
              tokens: s.tokens.map((t) => ({ ...t, status: liveStatus(t, cards) })),
            })),
          )
        : null,
    [annotatedParas, cards],
  );

  // TTS helpers
  const stopTts = () => {
    ttsRunRef.current++;
    stopAudio();
    setPlayingIdx(null);
  };

  const speakLine = async (idx: number, text: string, gender?: "f" | "m") => {
    if (playingIdx === idx) {
      stopTts();
      return;
    }
    const mine = ++ttsRunRef.current;
    setPlayingIdx(idx);
    const accent = gender ? (gender === "m" ? "us" : "uk") : voice;
    const how = await play(null, text, accent);
    if (how === "unsupported") {
      toast("这台设备暂无本地法语语音；可在「我的 → AI 接口」配置 Azure 朗读", "warn");
    }
    if (mine === ttsRunRef.current) setPlayingIdx(null);
  };

  const speakAll = async () => {
    if (playingIdx !== null) {
      stopTts();
      return;
    }
    const mine = ++ttsRunRef.current;
    for (let i = 0; i < frParagraphs.length && mine === ttsRunRef.current; i++) {
      setPlayingIdx(i);
      const gender = dialogueLines?.[i]?.gender;
      const accent = gender ? (gender === "m" ? "us" : "uk") : voice;
      const how = await play(null, frParagraphs[i], accent);
      if (how === "stopped" || how === "unsupported") break;
    }
    if (mine === ttsRunRef.current) setPlayingIdx(null);
  };

  // Clip & AI helpers
  const handleClip = (fr: string, zh: string) => {
    saveLoungeClip({ fr, zh, source: sourceLabel });
    toast("已收进文化实例笔记", "ok");
  };

  const handleAiTranslate = async (idx: number, fr: string) => {
    const key = `zh-${idx}`;
    if (aiBusyKey) return;
    setAiBusyKey(key);
    try {
      const res = await aiJson<{ zh: string }>("text", {
        system: "你是精准优雅的法汉文学译者。将给定法语段落自然翻译为简体中文，只输出 JSON。",
        text: fr,
        schemaName: "lounge_para_zh",
        schema: {
          type: "object",
          properties: { zh: { type: "string" } },
          required: ["zh"],
          additionalProperties: false,
        },
        maxTokens: 800,
      });
      if (res?.zh) setAiZhMap((m) => ({ ...m, [idx]: res.zh }));
    } catch (e) {
      toast((e as Error).message || "AI 翻译失败", "warn");
    } finally {
      setAiBusyKey(null);
    }
  };

  const handleAiNote = async (idx: number, fr: string) => {
    const key = `note-${idx}`;
    if (aiBusyKey) return;
    setAiBusyKey(key);
    try {
      const res = await aiJson<{ noteZh: string }>("text", {
        system:
          "你是法语文化与 DELF B2 语体顾问。用简明中文（80-140字）点拨这段法语中的地道搭配、语体色彩（soutenu/courant/familier）或文化背景，只输出 JSON。",
        text: fr,
        schemaName: "lounge_culture_note",
        schema: {
          type: "object",
          properties: { noteZh: { type: "string" } },
          required: ["noteZh"],
          additionalProperties: false,
        },
        maxTokens: 600,
      });
      if (res?.noteZh) setAiNoteMap((m) => ({ ...m, [idx]: res.noteZh }));
    } catch (e) {
      toast((e as Error).message || "AI 解析失败", "warn");
    } finally {
      setAiBusyKey(null);
    }
  };

  // Study Mode word deck helper
  const deck = decks.find((d) => d.id === readDeck) ?? decks.find((d) => d.name === LOUNGE_DECK);
  const ensureTargetDeck = () => {
    if (deck) return deck.id;
    const id = createDeck(LOUNGE_DECK);
    store.settings({ readDeck: id });
    return id;
  };

  const addStudyWordToDeck = (p: PickedStudyWord) => {
    const { tok } = p;
    const ref = tok.id ? atlas.byId.get(tok.id) : undefined;
    if (!ref && !tok.hit) return;
    const deckId = ensureTargetDeck();
    const span: [number, number] | undefined =
      p.sentence.length <= MAX_SOURCE_SENTENCE ? [tok.s, tok.e] : undefined;
    const { added } = addPicked(
      deckId,
      [
        ref
          ? {
              kind: cards[ref.id] ? "learning" : "atlas",
              id: ref.id,
              word: ref.word,
              zh: ref.zh,
              sentence: p.sentence,
              span,
            }
          : {
              kind: "dict",
              word: tok.hit!.w,
              pos: tok.hit!.p,
              ipa: tok.hit!.ipa,
              zh: joinGlosses(tok.hit!.zh ?? []),
              sentence: p.sentence,
              span,
              dictEx: (tok.hit!.ex ?? [])
                .slice(0, 1)
                .map(([fr, zh, a, b]) => ({
                  fr,
                  zh,
                  src: "tatoeba" as const,
                  hl: [a, b] as [number, number],
                })),
            },
      ],
      true,
    );
    const name = store.get().progress.decks?.find((d) => d.id === deckId)?.name ?? LOUNGE_DECK;
    toast(added ? `已连同原句加入「${name}」` : "该词暂无中文释义，未加入", added ? "ok" : "warn");
  };

  const switchChapter = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(totalChapters - 1, nextIdx));
    stopTts();
    setChIdx(clamped);
    go({ page: "lounge", shelf: "books", item: itemId, ch: String(clamped) }, null, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMarkDone = () => {
    if (kind === "book") {
      const title = bundledBook?.titleZh || bundledBook?.title || userBook?.title;
      markBookChapterDone(itemId, chIdx, totalChapters, title);
      if (chIdx + 1 < totalChapters) {
        toast(`第 ${chIdx + 1} 章已读完 · 已计入今日轻度漫游`, "ok");
        switchChapter(chIdx + 1);
      } else {
        toast("恭喜读完全书 · 已计入今日轻度漫游 ✨", "ok");
      }
    } else if (microRead) {
      markMicroReadDone(microRead.id, `${microRead.title} · ${microRead.titleZh}`);
      toast("已标记读完 · 已计入今日轻度漫游 ✨", "ok");
    }
  };

  // Chapter audio URL if any
  const activeChapterAudioUrl = useMemo(() => {
    const raw = bundledBook?.chapters[chIdx]?.audioUrl;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = import.meta.env.BASE_URL || "/";
    return `${base}${raw.replace(/^\//, "")}`;
  }, [bundledBook, chIdx]);

  // Series navigation for mystery micro-reads
  const seriesSiblings = useMemo(() => {
    if (!microRead?.series) return null;
    const list = LOUNGE_MICRO_READS.filter((r) => r.series?.id === microRead.series?.id);
    const idx = list.findIndex((r) => r.id === microRead.id);
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null,
    };
  }, [microRead]);

  const setQuickAmbience = (id: AmbienceId | "off") => {
    store.settings({ ambience: ambience === id ? "off" : id });
  };

  const renderStudySentences = (paraIdx: number, fallbackText: string) => {
    const sents = coloredParas?.[paraIdx];
    const rawSents = annotatedParas?.[paraIdx];
    if (!sents || !rawSents) {
      return (
        <span lang="fr" data-lounge-sentence={fallbackText} data-lounge-source={sourceLabel}>
          {fallbackText}
        </span>
      );
    }
    return (
      <span
        className="is-colored"
        lang="fr"
        data-lounge-sentence={fallbackText}
        data-lounge-source={sourceLabel}
      >
        {sents.map((s, si) => {
          const parts: React.ReactNode[] = [];
          let pos = 0;
          s.tokens.forEach((t, ti) => {
            if (t.s > pos) parts.push(s.text.slice(pos, t.s));
            const rawTok = rawSents[si]?.tokens[ti] ?? t;
            parts.push(
              t.status === "name" ? (
                <span key={ti}>{t.t}</span>
              ) : (
                <button
                  key={ti}
                  type="button"
                  className={`rw rw-${t.status} ${pickedWord?.tok === rawTok ? "is-picked" : ""}`}
                  onClick={() =>
                    setPickedWord((cur) =>
                      cur?.tok === rawTok ? null : { tok: rawTok, sentence: s.text },
                    )
                  }
                >
                  {t.t}
                </button>
              ),
            );
            pos = t.e;
          });
          if (pos < s.text.length) parts.push(s.text.slice(pos));
          return <span key={si}>{parts} </span>;
        })}
      </span>
    );
  };

  const pickedRef = pickedWord?.tok.id ? atlas.byId.get(pickedWord.tok.id) : undefined;
  const inDeck = Boolean(pickedRef && deck?.words.includes(pickedRef.id));

  // Missing item fallback
  if (kind === "read" && !microRead) {
    return (
      <div className="panel">
        <p>未找到该篇小品。</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => go({ page: "lounge", shelf: "reads" })}
        >
          <ArrowLeft size={16} /> 返回小品书架
        </button>
      </div>
    );
  }

  if (kind === "book" && !bundledBook && !userBookLoading && !userBook) {
    return (
      <div className="panel">
        <p>未找到这本电子书（可能已被清理或尚未导入）。</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => go({ page: "lounge", shelf: "books" })}
        >
          <ArrowLeft size={16} /> 返回书架
        </button>
      </div>
    );
  }

  const displayTitle =
    kind === "read"
      ? microRead!.title
      : bundledBook
        ? chapterData?.title || bundledBook.title
        : userBook?.chapters[chIdx]?.title || userBook?.title || "";

  const displaySub =
    kind === "read"
      ? `${microRead!.titleZh} · ${microRead!.minutes} 分钟`
      : bundledBook
        ? `《${bundledBook.titleZh}》· ${chapterData?.titleZh || bundledBook.chapters[chIdx]?.titleZh || ""}`
        : userBook
          ? `《${userBook.title}》· 第 ${chIdx + 1}/${userBook.chapters.length} 章`
          : "";

  const calloutTip = kind === "read" ? microRead?.b2TipZh : chapterData?.noteZh;
  const isDone = kind === "read" ? Boolean(mediaProg?.done) : Boolean(bookProg?.done);

  return (
    <WordPopup className="lounge-reader-wrap">
      {/* Sticky Top Bar */}
      <div className="lounge-topbar" role="toolbar" aria-label="漫游阅读控制栏">
        <div className="lounge-topbar-group">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => go({ page: "lounge", shelf: kind === "read" ? "reads" : "books" })}
          >
            <ArrowLeft size={15} /> 书架
          </button>

          {/* [☕ 躺平放松 | 🔍 顺手精学] */}
          <div className="lounge-seg" role="group" aria-label="阅读心境切换">
            <button
              type="button"
              className={loungeMode === "chill" ? "is-on" : ""}
              aria-pressed={loungeMode === "chill"}
              onClick={() => setLoungeMode("chill")}
            >
              ☕ 躺平放松
            </button>
            <button
              type="button"
              className={loungeMode === "study" ? "is-on" : ""}
              aria-pressed={loungeMode === "study"}
              onClick={() => setLoungeMode("study")}
            >
              <Search size={12} /> 顺手精学
            </button>
          </div>

          {/* [中法对照 | 仅法语] */}
          {hasZh ? (
            <div className="lounge-seg" role="group" aria-label="双语显示切换">
              <button
                type="button"
                className={bilingual ? "is-on" : ""}
                aria-pressed={bilingual}
                onClick={() => setBilingual(true)}
              >
                中法对照
              </button>
              <button
                type="button"
                className={!bilingual ? "is-on" : ""}
                aria-pressed={!bilingual}
                onClick={() => setBilingual(false)}
              >
                仅法语
              </button>
            </div>
          ) : (
            <span className="lounge-badge" title="自导入原版法语书不含预置译文">
              仅法语原版
            </span>
          )}
        </div>

        {/* Quick Ambience + Gentle Break Timer */}
        <div className="lounge-topbar-group">
          <button
            type="button"
            className={`lounge-mini-pill ${ambience === "rain" ? "is-on" : ""}`}
            aria-pressed={ambience === "rain"}
            onClick={() => setQuickAmbience("rain")}
            title="雨天图书馆白噪音"
          >
            <CloudRain size={13} /> 雨声
          </button>
          <button
            type="button"
            className={`lounge-mini-pill ${ambience === "cafe" ? "is-on" : ""}`}
            aria-pressed={ambience === "cafe"}
            onClick={() => setQuickAmbience("cafe")}
            title="安静咖啡馆白噪音"
          >
            <Coffee size={13} /> 咖啡馆
          </button>
          <button
            type="button"
            className={`lounge-mini-pill ${ambience === "fire" ? "is-on" : ""}`}
            aria-pressed={ambience === "fire"}
            onClick={() => setQuickAmbience("fire")}
            title="夜晚壁炉白噪音"
          >
            <Flame size={13} /> 壁炉
          </button>
          {microRead?.recommendedAmbience &&
            !["rain", "cafe", "fire"].includes(microRead.recommendedAmbience) && (
              <button
                type="button"
                className={`lounge-mini-pill ${ambience === microRead.recommendedAmbience ? "is-on" : ""}`}
                aria-pressed={ambience === microRead.recommendedAmbience}
                onClick={() => setQuickAmbience(microRead.recommendedAmbience!)}
              >
                🎧 {AMBIENCE.find((a) => a.id === microRead.recommendedAmbience)?.label ?? "推荐环境声"}
              </button>
            )}
          {ambience !== "off" && (
            <button
              type="button"
              className="lounge-mini-pill"
              onClick={() => store.settings({ ambience: "off" })}
              aria-label="关闭环境声"
              title="关闭环境声"
            >
              <VolumeX size={13} /> 静音
            </button>
          )}

          {/* Gentle Break Timer */}
          <div className="lounge-seg" role="group" aria-label="温柔小憩计时器">
            {timerSec !== null ? (
              <button
                type="button"
                className="is-on"
                onClick={() => setTimerSec(null)}
                title="点击取消小憩计时"
              >
                <Clock size={12} /> 小憩 {formatCountdown(timerSec)} ×
              </button>
            ) : (
              [10, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setBreakAlert(false);
                    setTimerSec(m * 60);
                    toast(`已开启 ${m} 分钟温柔小憩计时`, "info");
                  }}
                >
                  {m}m
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {breakAlert && (
        <div className="lounge-break-banner" role="status">
          <span>🌙 温柔小憩时间到啦 · 已经沉浸读了一会儿，去喝口水或闭眼休息一下吧。</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBreakAlert(false)}>
            知道了
          </button>
        </div>
      )}

      <article className="lounge-paper">
        <header className="lounge-reader-head">
          {kind === "book" && (bundledBook || userBook) && (
            <div className="lounge-chapter-row">
              <select
                className="lounge-select"
                aria-label="切换章节"
                value={chIdx}
                onChange={(e) => switchChapter(Number(e.target.value))}
              >
                {(bundledBook ? bundledBook.chapters : userBook!.chapters).map((c, idx) => (
                  <option key={c.id} value={idx}>
                    第 {idx + 1} 章 · {c.title}
                    {"titleZh" in c && c.titleZh ? `（${c.titleZh}）` : ""}
                  </option>
                ))}
              </select>
              {loungeMode === "study" && frParagraphs.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void speakAll()}
                >
                  {playingIdx !== null ? <Pause size={14} /> : <Play size={14} />}{" "}
                  {playingIdx !== null ? "停止朗读" : "连播本章"}
                </button>
              )}
            </div>
          )}

          {kind === "read" && loungeMode === "study" && frParagraphs.length > 0 && (
            <div className="lounge-chapter-row">
              <span className="eyebrow">{microRead?.authorNote}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void speakAll()}>
                {playingIdx !== null ? <Pause size={14} /> : <Play size={14} />}{" "}
                {playingIdx !== null ? "停止朗读" : dialogueLines ? "分角色连播对话" : "连播全文"}
              </button>
            </div>
          )}

          <h1 className="lounge-reader-title" lang="fr">
            {displayTitle}
          </h1>
          <p className="lounge-reader-sub">{displaySub}</p>

          {activeChapterAudioUrl && (
            <div className="lounge-audio-box">
              <span className="lounge-badge">🎧 原声朗读</span>
              <audio
                ref={audioRef}
                controls
                preload="none"
                src={activeChapterAudioUrl}
                onPlay={() => suspendAmbience(true)}
                onPause={() => suspendAmbience(false)}
                onEnded={() => suspendAmbience(false)}
              />
            </div>
          )}
        </header>

        {chapterLoading || userBookLoading ? (
          <p className="muted">正在展开书页…</p>
        ) : chapterErr ? (
          <p className="muted">{chapterErr}</p>
        ) : dialogueLines ? (
          /* ---------- Dialogue Micro-Read Layout ---------- */
          <div className="lounge-dialogue">
            {dialogueLines.map((line, i) => {
              const showLineZh = bilingual || Boolean(paraZhOpen[i]);
              return (
                <div key={i} className={`lounge-turn is-${line.gender}`}>
                  <div className="lounge-turn-head">
                    <span className="lounge-speaker">
                      {line.speaker} {line.gender === "f" ? "♀" : "♂"}
                    </span>
                    {loungeMode === "study" && (
                      <div className="lounge-para-tools">
                        <button
                          type="button"
                          className={`lounge-para-btn ${playingIdx === i ? "is-on" : ""}`}
                          onClick={() => void speakLine(i, line.fr, line.gender)}
                        >
                          <Volume2 size={12} /> {playingIdx === i ? "停止" : "读这句"}
                        </button>
                        <button
                          type="button"
                          className="lounge-para-btn"
                          onClick={() => handleClip(line.fr, line.zh)}
                        >
                          <BookmarkPlus size={12} /> 收进文化实例笔记
                        </button>
                        {aiReady && (
                          <button
                            type="button"
                            className="lounge-para-btn"
                            disabled={aiBusyKey === `note-${i}`}
                            onClick={() => void handleAiNote(i, line.fr)}
                          >
                            <Sparkles size={12} />{" "}
                            {aiBusyKey === `note-${i}` ? "解析中…" : "AI 语体点拨"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p
                    className="lounge-fr-para"
                    lang="fr"
                    data-lounge-sentence={line.fr}
                    data-lounge-source={sourceLabel}
                  >
                    {loungeMode === "study" ? renderStudySentences(i, line.fr) : line.fr}
                  </p>

                  {showLineZh ? (
                    <p className="lounge-zh-para">{line.zh}</p>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="lounge-para-btn"
                        onClick={() => setParaZhOpen((m) => ({ ...m, [i]: true }))}
                      >
                        查看本句译文
                      </button>
                    </div>
                  )}

                  {!bilingual && paraZhOpen[i] && (
                    <div>
                      <button
                        type="button"
                        className="lounge-para-btn"
                        onClick={() => setParaZhOpen((m) => ({ ...m, [i]: false }))}
                      >
                        收起译文
                      </button>
                    </div>
                  )}

                  {aiNoteMap[i] && <div className="lounge-ai-note">{aiNoteMap[i]}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          /* ---------- Standard Prose Layout (Chill & Study) ---------- */
          <div className={`lounge-prose ${loungeMode === "study" ? "is-study" : "is-chill"}`}>
            {frParagraphs.map((para, i) => {
              const zhText = zhParagraphs[i] || aiZhMap[i] || "";
              const showParaZh = (hasZh && bilingual) || Boolean(paraZhOpen[i]) || Boolean(aiZhMap[i]);

              return (
                <div key={i} className="lounge-para-block">
                  {loungeMode === "chill" ? (
                    <p
                      className="lounge-fr-para"
                      lang="fr"
                      data-lounge-sentence={para}
                      data-lounge-source={sourceLabel}
                    >
                      {para}
                    </p>
                  ) : (
                    <div className="lounge-fr-para">{renderStudySentences(i, para)}</div>
                  )}

                  {showParaZh && zhText && <p className="lounge-zh-para">{zhText}</p>}

                  <div className="lounge-para-tools">
                    {hasZh && !bilingual && (
                      <button
                        type="button"
                        className="lounge-para-btn"
                        onClick={() => setParaZhOpen((m) => ({ ...m, [i]: !m[i] }))}
                      >
                        {paraZhOpen[i] ? "收起译文" : "查看本段译文"}
                      </button>
                    )}

                    {!hasZh && aiReady && !aiZhMap[i] && (
                      <button
                        type="button"
                        className="lounge-para-btn"
                        disabled={aiBusyKey === `zh-${i}`}
                        onClick={() => void handleAiTranslate(i, para)}
                      >
                        <Sparkles size={12} />{" "}
                        {aiBusyKey === `zh-${i}` ? "翻译中…" : "AI 翻译本段"}
                      </button>
                    )}

                    {loungeMode === "study" && (
                      <>
                        <button
                          type="button"
                          className={`lounge-para-btn ${playingIdx === i ? "is-on" : ""}`}
                          onClick={() => void speakLine(i, para)}
                        >
                          <Volume2 size={12} /> {playingIdx === i ? "停止" : "朗读本段"}
                        </button>
                        <button
                          type="button"
                          className="lounge-para-btn"
                          onClick={() => handleClip(para, zhText)}
                        >
                          <BookmarkPlus size={12} /> 收进文化实例笔记
                        </button>
                        {aiReady && (
                          <button
                            type="button"
                            className="lounge-para-btn"
                            disabled={aiBusyKey === `note-${i}`}
                            onClick={() => void handleAiNote(i, para)}
                          >
                            <Sparkles size={12} />{" "}
                            {aiBusyKey === `note-${i}` ? "解析中…" : "AI 文化与语体点拨"}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {aiNoteMap[i] && <div className="lounge-ai-note">{aiNoteMap[i]}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Interactive Non-Graded Poll for Mystery Episodes */}
        {microRead?.poll && (
          <section className="lounge-poll" aria-label="线索推理互动（不计分）">
            <span className="eyebrow">侦探推理小投票 · 不计入任何成绩</span>
            <h3>{microRead.poll.questionZh}</h3>
            <div className="lounge-poll-opts">
              {microRead.poll.optionsZh.map((opt, idx) => {
                const revealed = pollChoice !== null;
                const isReveal = revealed && idx === microRead.poll!.revealIndex;
                const isPicked = pollChoice === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`lounge-poll-opt ${isReveal ? "is-reveal" : isPicked ? "is-picked" : ""}`}
                    onClick={() => setPollChoice(idx)}
                  >
                    <span>{opt}</span>
                    {isReveal && <Check size={15} />}
                  </button>
                );
              })}
            </div>
            {pollChoice !== null && (
              <p className="lounge-card-desc">{microRead.poll.revealZh}</p>
            )}
          </section>
        )}

        {/* Cultural / B2 Expression Callout */}
        {calloutTip && (
          <aside className="lounge-tip" aria-label="法语表达与文化小贴士">
            <span className="eyebrow">顺手采撷 · 表达与文化注记</span>
            <p className="lounge-card-desc">{calloutTip}</p>
          </aside>
        )}

        {/* Footer Navigation & Mark Done */}
        <footer className="lounge-reader-foot">
          {kind === "book" ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={chIdx <= 0}
                onClick={() => switchChapter(chIdx - 1)}
              >
                <ArrowLeft size={15} /> 上一章
              </button>
              <button type="button" className="btn btn-primary" onClick={handleMarkDone}>
                <Check size={16} /> 读完本章
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={chIdx + 1 >= totalChapters}
                onClick={() => switchChapter(chIdx + 1)}
              >
                下一章 <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              {seriesSiblings?.prev ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    go({ page: "lounge", shelf: "reads", item: seriesSiblings.prev!.id })
                  }
                >
                  <ArrowLeft size={15} /> 上一集
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className={`btn ${isDone ? "btn-ghost" : "btn-primary"}`}
                onClick={handleMarkDone}
              >
                <Check size={16} /> {isDone ? "已读完这篇" : "读完这篇"}
              </button>
              {seriesSiblings?.next ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    go({ page: "lounge", shelf: "reads", item: seriesSiblings.next!.id })
                  }
                >
                  下一集 <ArrowRight size={15} />
                </button>
              ) : (
                <span />
              )}
            </>
          )}
        </footer>
      </article>

      {/* Study Mode Token Detail Popover */}
      {loungeMode === "study" &&
        pickedWord &&
        createPortal(
          <aside className="reader-word" role="dialog" aria-label="精学查词">
            <button
              type="button"
              className="icon-btn reader-word-close"
              onClick={() => setPickedWord(null)}
              aria-label="关闭"
            >
              <X size={18} />
            </button>
            <div className="reader-word-main">
              <p className="reader-word-head">
                <b lang="fr">
                  {pickedRef?.word ?? pickedWord.tok.hit?.w ?? pickedWord.tok.t}
                </b>
                {pickedWord.tok.hit?.p && <span className="pos">{pickedWord.tok.hit.p}</span>}
                {(pickedRef?.ipa || pickedWord.tok.hit?.ipa) && (
                  <span className="ipa">{pickedRef?.ipa || pickedWord.tok.hit?.ipa}</span>
                )}
              </p>
              <p className="reader-word-zh">
                {pickedRef
                  ? [pickedRef.zh, ...(pickedRef.more ?? [])].join("；")
                  : pickedWord.tok.hit
                    ? joinGlosses(pickedWord.tok.hit.zh ?? [], 4) || "暂无简明中文释义"
                    : "词库暂未收录该词形，可前往词典页查看。"}
              </p>
            </div>
            <div className="reader-word-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void play(null, pickedWord.sentence, voice)}
              >
                <Play size={14} /> 读原句
              </button>
              {pickedRef && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => openWord(pickedRef.id)}
                >
                  <BookOpenText size={14} /> 词条
                </button>
              )}
              <a
                className="btn btn-ghost btn-sm"
                href={href({
                  page: "dict",
                  w: pickedRef?.word ?? pickedWord.tok.hit?.w ?? pickedWord.tok.t,
                })}
              >
                词典详情 →
              </a>
              {(pickedRef || pickedWord.tok.hit?.zh?.length) &&
                (inDeck ? (
                  <span className="reader-in-deck">
                    <Check size={14} /> 已在「{deck?.name ?? LOUNGE_DECK}」
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => addStudyWordToDeck(pickedWord)}
                  >
                    <Plus size={14} /> 加入生词本（连同原句）
                  </button>
                ))}
            </div>
          </aside>,
          document.body,
        )}
    </WordPopup>
  );
}
