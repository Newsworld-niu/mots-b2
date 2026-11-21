import { BookOpenText, Check, ExternalLink, Plus, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/dict.css";
import { useAtlas } from "../atlas/context";
import { play } from "../lib/audio";
import { frdicUrl } from "../lib/frdic";
import { getEntryById, loadMeta, setLexdbFixtures } from "../lib/lexdb/load";
import { entryToSeed, resolve, type ResolveResult } from "../lib/lexdb/search";
import { lexdbFold, type LexEntry } from "../lib/lexdb/types";
import accueilFixture from "../lib/lexdb/fixtures/accueil.json";
import beauFixture from "../lib/lexdb/fixtures/beau.json";
import prendreFixture from "../lib/lexdb/fixtures/prendre.json";
import { isNative } from "../lib/native";
import { href, openWord } from "../lib/router";
import { addToDeck, createDeck, findSame } from "../store/decks";
import { store, useStore } from "../store/store";
import { Sheet } from "./Sheet";
import { toast } from "./Toast";
import { WordForm } from "./WordForm";

const POPUP_DECK = "阅读生词";

export const LEXDB_FIXTURES: readonly LexEntry[] = [
  accueilFixture as LexEntry,
  prendreFixture as LexEntry,
  beauFixture as LexEntry,
];

const FIXTURE_FORMS: Record<string, string[]> = {
  accueils: ["accueil"],
  prend: ["prendre"],
  prends: ["prendre"],
  prenons: ["prendre"],
  prenez: ["prendre"],
  prennent: ["prendre"],
  pris: ["prendre"],
  prise: ["prendre"],
  prises: ["prendre"],
  prenait: ["prendre"],
  prenaient: ["prendre"],
  prendra: ["prendre"],
  prit: ["prendre"],
  belle: ["beau"],
  beaux: ["beau"],
  belles: ["beau"],
  bel: ["beau"],
};

const ELISION_RE = /^(?:l|d|qu|j|m|t|s|n|c|jusqu|lorsqu|puisqu|quoiqu)['’]/i;
const WORD_CHAR_RE = /[\p{L}'’\-]/u;
const FRENCH_LETTER_RE = /[A-Za-zÀ-ÿŒœ]/;

function cleanSelectionText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[«»"“”'‘’.,;:!?()[\]{}…—–\-]+|[«»"“”'‘’.,;:!?()[\]{}…—–\-]+$/g, "")
    .trim();
}

function stripElision(word: string): string {
  return word.replace(ELISION_RE, "").trim();
}

function resolveFromFixtures(rawQuery: string): ResolveResult {
  const folded = lexdbFold(rawQuery);
  if (!folded) return { entries: [], matchedVia: "none" };

  const direct = LEXDB_FIXTURES.filter((e) => e.id === folded || lexdbFold(e.w) === folded);
  if (direct.length) return { entries: direct, matchedVia: "exact" };

  const formTargets = FIXTURE_FORMS[folded];
  if (formTargets?.length) {
    const entries = LEXDB_FIXTURES.filter((e) => formTargets.includes(e.id));
    if (entries.length) return { entries, matchedVia: "form", formTarget: entries[0].w };
  }

  const phraseHits = LEXDB_FIXTURES.filter((e) =>
    (e.phrases ?? []).some((p) => {
      const pf = lexdbFold(p.fr);
      return pf === folded || (folded.includes(" ") && pf.includes(folded));
    }),
  );
  if (phraseHits.length) return { entries: phraseHits, matchedVia: "phrase" };

  return { entries: [], matchedVia: "none" };
}

/** Resolve a word or phrase using LexDB shards, with automatic fixture fallback when public/lexdb is absent. */
export async function lookupLexdbWithFallback(rawQuery: string): Promise<ResolveResult> {
  const q = cleanSelectionText(rawQuery);
  if (!q || q.length > 80) return { entries: [], matchedVia: "none" };

  const meta = await loadMeta();
  if (!meta) {
    setLexdbFixtures(LEXDB_FIXTURES);
    const directFix = resolveFromFixtures(q);
    if (directFix.entries.length) return directFix;
    const stripped = stripElision(q);
    if (stripped && stripped !== q) return resolveFromFixtures(stripped);
    return { entries: [], matchedVia: "none" };
  }

  if (/^[^#]+#\d+$/.test(q)) {
    const byId = await getEntryById(q);
    if (byId) return { entries: [byId], matchedVia: "exact" };
  }

  const res = await resolve(q);
  if (res.entries.length > 0) return res;

  const stripped = stripElision(q);
  if (stripped && stripped !== q) {
    return resolve(stripped);
  }
  return res;
}

function extractTappedFrenchWord(container: HTMLElement, clientX: number, clientY: number): string | null {
  let textNode: Node | null = null;
  let offset = 0;

  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    const r = doc.caretRangeFromPoint(clientX, clientY);
    if (r) {
      textNode = r.startContainer;
      offset = r.startOffset;
    }
  } else if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      textNode = pos.offsetNode;
      offset = pos.offset;
    }
  }

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE || !container.contains(textNode)) return null;
  const frParent = textNode.parentElement?.closest("[lang]");
  if (frParent?.getAttribute("lang") !== "fr") return null;

  const text = textNode.textContent ?? "";
  if (!text.trim()) return null;

  let pos = Math.min(Math.max(0, offset), text.length);
  if (pos === text.length && pos > 0) pos--;
  if (!WORD_CHAR_RE.test(text[pos]) && pos > 0 && WORD_CHAR_RE.test(text[pos - 1])) {
    pos--;
  }
  if (!WORD_CHAR_RE.test(text[pos])) return null;

  let start = pos;
  let end = pos + 1;
  while (start > 0 && WORD_CHAR_RE.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR_RE.test(text[end])) end++;
  while (start < end && /['’\-]/.test(text[start])) start++;
  while (end > start && /['’\-]/.test(text[end - 1])) end--;
  if (start >= end) return null;

  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const rects = Array.from(range.getClientRects());
  const hit = rects.some(
    (rc) => clientX >= rc.left - 5 && clientX <= rc.right + 5 && clientY >= rc.top - 5 && clientY <= rc.bottom + 5,
  );
  if (!hit) return null;

  const token = cleanSelectionText(text.slice(start, end));
  return token && FRENCH_LETTER_RE.test(token) ? token : null;
}

interface PopupState {
  query: string;
  loading: boolean;
  result: ResolveResult | null;
}

export interface WordPopupProps {
  children?: React.ReactNode;
  containerRef?: React.RefObject<HTMLElement | null>;
  allowWordTap?: boolean;
  className?: string;
}

/**
 * Tap/select-to-lookup floating card backed by LexDB.
 * Wrap a page/section with `<WordPopup>...</WordPopup>` or attach `<WordPopup containerRef={ref} />`.
 */
export function WordPopup({ children, containerRef, allowWordTap = true, className }: WordPopupProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const reqId = useRef(0);
  const lastSelectAt = useRef(0);

  const atlas = useAtlas();
  const decks = useStore((s) => s.progress.decks) ?? [];
  const readDeck = useStore((s) => s.settings.readDeck);
  const voice = useStore((s) => s.settings.accent);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [formState, setFormState] = useState<{ entry: LexEntry; deckId: string } | null>(null);

  const close = useCallback(() => {
    reqId.current++;
    setPopup(null);
  }, []);

  const lookup = useCallback(async (rawText: string) => {
    const query = cleanSelectionText(rawText);
    if (!query || query.length > 60 || !FRENCH_LETTER_RE.test(query)) return;
    const id = ++reqId.current;
    setPopup({ query, loading: true, result: null });
    try {
      const result = await lookupLexdbWithFallback(query);
      if (reqId.current === id) setPopup({ query, loading: false, result });
    } catch {
      if (reqId.current === id) setPopup({ query, loading: false, result: { entries: [], matchedVia: "none" } });
    }
  }, []);

  useEffect(() => {
    const el = containerRef?.current ?? internalRef.current;
    if (!el) return;

    const checkSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return false;
      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!anchor || !focus || !el.contains(anchor) || !el.contains(focus)) return false;
      const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
      if (anchorEl?.closest("input, textarea, .word-popup")) return false;
      const text = cleanSelectionText(sel.toString());
      if (!text || text.length > 60 || !FRENCH_LETTER_RE.test(text)) return false;
      lastSelectAt.current = Date.now();
      void lookup(text);
      return true;
    };

    const onMouseUp = () => {
      window.setTimeout(() => {
        checkSelection();
      }, 12);
    };

    const onTouchEnd = () => {
      window.setTimeout(() => {
        checkSelection();
      }, 30);
    };

    const onClick = (e: MouseEvent) => {
      if (!allowWordTap) return;
      if (Date.now() - lastSelectAt.current < 200) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && cleanSelectionText(sel.toString())) return;

      const target = e.target as Element | null;
      if (!target || !el.contains(target)) return;
      if (target.closest("button, a, input, textarea, select, label, summary, [role='button'], [role='radio'], .rw, .word-popup")) {
        return;
      }
      const token = extractTappedFrenchWord(el, e.clientX, e.clientY);
      if (token) void lookup(token);
    };

    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("click", onClick);
    };
  }, [containerRef, allowWordTap, lookup]);

  useEffect(() => {
    if (!popup || formState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && popupRef.current?.contains(target)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const container = containerRef?.current ?? internalRef.current;
      if (target && container?.contains(target)) {
        const elem = target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
        if (allowWordTap && elem?.closest("[lang='fr']") && !elem.closest("button, a, input, textarea, select, label, summary, .rw")) {
          return;
        }
      }
      close();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [popup, formState, allowWordTap, containerRef, close]);

  const deck = decks.find((d) => d.id === readDeck);
  const deckName = deck?.name ?? POPUP_DECK;
  const targetDeck = () => {
    if (deck) return deck.id;
    const id = decks.find((d) => d.name === POPUP_DECK)?.id ?? createDeck(POPUP_DECK);
    store.settings({ readDeck: id });
    return id;
  };

  const entry = popup?.result?.entries[0] ?? null;
  const atlasMatch = useMemo(() => (entry ? findSame(atlas, entry.w)[0] : undefined), [atlas, entry]);
  const inDeck = !!atlasMatch && !!deck?.words.includes(atlasMatch.id);

  const topSenses = useMemo(() => {
    if (!entry) return [];
    const out: { p: string; zh: string }[] = [];
    for (const posBlk of entry.pos) {
      for (const s of posBlk.senses) {
        if (s.zh) out.push({ p: posBlk.p, zh: s.zh });
        if (out.length >= 3) return out;
      }
    }
    return out;
  }, [entry]);

  const speakWord = async (w: string, entryRef?: LexEntry | null) => {
    setSpeaking(true);
    try {
      const ref = entryRef?.atlasId ? atlas.byId.get(entryRef.atlasId) : atlasMatch;
      const url = ref ? atlas.audio(ref, voice) : null;
      const how = await play(url, w, voice);
      if (how === "unsupported") toast("这台设备没有法语朗读声音", "warn");
    } finally {
      setSpeaking(false);
    }
  };

  const cardNode =
    popup &&
    createPortal(
      <aside ref={popupRef} className="word-popup" role="dialog" aria-label="划词查词">
        <button type="button" className="icon-btn word-popup-close" onClick={close} aria-label="关闭划词窗口">
          <X size={17} />
        </button>

        {popup.loading ? (
          <div className="word-popup-head">
            <b className="word-popup-word" lang="fr">
              {popup.query}
            </b>
            <span className="muted small">查询词典中…</span>
          </div>
        ) : entry ? (
          <>
            <div className="word-popup-head">
              <b className="word-popup-word" lang="fr">
                {entry.w}
              </b>
              {entry.level && <span className={`chip chip-level lv-${entry.level}`}>{entry.level}</span>}
              {entry.pos[0]?.p && <span className="pos">{entry.pos[0].p}</span>}
              {entry.ipa && <span className="ipa">[{entry.ipa}]</span>}
              <button
                type="button"
                className={`dict-voice-btn ${speaking ? "is-on" : ""}`}
                onClick={() => void speakWord(entry.w, entry)}
                aria-label={`朗读 ${entry.w}`}
              >
                <Volume2 size={14} /> 朗读
              </button>
              {popup.result?.matchedVia === "form" && (
                <small className="muted">「{popup.query}」→ 原形</small>
              )}
              {popup.result?.matchedVia === "phrase" && (
                <small className="muted">短语搭配</small>
              )}
            </div>

            {topSenses.length > 0 ? (
              <ul className="word-popup-senses">
                {topSenses.map((s, idx) => (
                  <li key={idx}>
                    {s.p && <span className="pos">{s.p}</span>}
                    <span>{s.zh}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">暂无简明中文释义，可在词典详情中查看。</p>
            )}

            <div className="word-popup-actions">
              {atlasMatch && inDeck ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openWord(atlasMatch.id)}>
                  <Check size={14} /> 已在「{deckName}」
                </button>
              ) : atlasMatch ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const id = targetDeck();
                    addToDeck(id, atlasMatch.id);
                    const name = store.get().progress.decks?.find((d) => d.id === id)?.name ?? POPUP_DECK;
                    toast(`已加入「${name}」`, "ok");
                  }}
                >
                  <Plus size={14} /> 加入生词本 / 复习
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFormState({ entry, deckId: targetDeck() })}
                >
                  <Plus size={14} /> 加入生词本 / 复习
                </button>
              )}

              <a
                className="btn btn-primary btn-sm"
                href={href({ page: "dict", w: entry.w })}
                onClick={close}
              >
                <BookOpenText size={14} /> 词典详情 →
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="word-popup-head">
              <b className="word-popup-word" lang="fr">
                {popup.query}
              </b>
              <button
                type="button"
                className={`dict-voice-btn ${speaking ? "is-on" : ""}`}
                onClick={() => void speakWord(popup.query)}
                aria-label={`朗读 ${popup.query}`}
              >
                <Volume2 size={14} /> 朗读
              </button>
            </div>
            <p className="muted small">词库暂未精确匹配「{popup.query}」，可在词典页查看拼写纠错或外链查询。</p>
            <div className="word-popup-actions">
              <a
                className="btn btn-primary btn-sm"
                href={href({ page: "dict", w: popup.query })}
                onClick={close}
              >
                <BookOpenText size={14} /> 词典详情 →
              </a>
              <a
                className="btn btn-ghost btn-sm"
                href={frdicUrl(popup.query)}
                target={isNative() ? "_self" : "_blank"}
                rel="noopener noreferrer"
              >
                法语助手原文 <ExternalLink size={13} />
              </a>
            </div>
          </>
        )}
      </aside>,
      document.body,
    );

  const formSheet =
    formState &&
    createPortal(
      <Sheet open={!!formState} onClose={() => setFormState(null)} label="加入生词本" wide>
        <h2 className="sheet-title">加入生词本 / 复习 · {formState.entry.w}</h2>
        <WordForm
          mode="create"
          deckId={formState.deckId}
          seed={entryToSeed(formState.entry)}
          onDone={(id) => {
            setFormState(null);
            if (id) close();
          }}
        />
      </Sheet>,
      document.body,
    );

  if (children !== undefined) {
    return (
      <div ref={internalRef} className={className}>
        {children}
        {cardNode}
        {formSheet}
      </div>
    );
  }

  return (
    <>
      {cardNode}
      {formSheet}
    </>
  );
}
