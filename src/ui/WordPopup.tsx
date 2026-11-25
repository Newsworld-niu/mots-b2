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
import { LEXDB_FIXTURES } from "../lib/lexdb/fixtures";
import { isNative } from "../lib/native";
import { href, openWord } from "../lib/router";
import { MAX_SOURCE_SENTENCE, addPicked, addToDeck, createDeck, findExact, setDeckNote } from "../store/decks";
import { store, useStore } from "../store/store";
import { Sheet } from "./Sheet";
import { toast } from "./Toast";
import { WordForm } from "./WordForm";

const POPUP_DECK = "阅读生词";

export { LEXDB_FIXTURES };

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
const WORD_CHAR_RE = /[\p{L}'’-]/u;
const FRENCH_LETTER_RE = /[A-Za-zÀ-ÿŒœ]/;

function cleanSelectionText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[«»"“”'‘’.,;:!?()[\]{}…—–-]+|[«»"“”'‘’.,;:!?()[\]{}…—–-]+$/g, "")
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

interface LoungeTapContext {
  sentence?: string;
  source?: string;
}

function extractLoungeContext(node: Node | Element | null | undefined): LoungeTapContext | undefined {
  const el =
    node && "closest" in node && typeof node.closest === "function"
      ? node
      : node && "parentElement" in node
        ? node.parentElement
        : null;
  const host = el?.closest("[data-lounge-sentence]");
  if (!host) return undefined;
  const sentence = host.getAttribute("data-lounge-sentence")?.trim() || undefined;
  const source = host.getAttribute("data-lounge-source")?.trim() || undefined;
  return sentence || source ? { sentence, source } : undefined;
}

function findTokenSpan(sentence: string, candidates: readonly string[]): [number, number] | undefined {
  const lower = sentence.toLowerCase();
  const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);
  for (const raw of candidates) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    let from = 0;
    while (from <= lower.length - needle.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const before = idx > 0 ? sentence[idx - 1] : undefined;
      const after = end < sentence.length ? sentence[end] : undefined;
      if (!isLetter(before) && !isLetter(after)) {
        return [idx, end];
      }
      from = idx + 1;
    }
  }
  return undefined;
}

function prepareLoungeSentence(
  rawSentence: string,
  query: string,
  headword?: string,
): { sentence: string; span?: [number, number] } {
  const clean = rawSentence.replace(/\s+/g, " ").trim();
  const candidates = [...new Set([query, stripElision(query), ...(headword ? [headword] : [])].filter(Boolean))];
  if (clean.length <= MAX_SOURCE_SENTENCE) {
    return { sentence: clean, span: findTokenSpan(clean, candidates) };
  }
  const parts = clean.split(/(?<=[.!?…»])\s+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sp = findTokenSpan(trimmed, candidates);
    if (sp && trimmed.length <= MAX_SOURCE_SENTENCE) {
      return { sentence: trimmed, span: sp };
    }
  }
  const fullSpan = findTokenSpan(clean, candidates);
  if (!fullSpan) {
    return { sentence: `${clean.slice(0, MAX_SOURCE_SENTENCE - 1).trimEnd()}…` };
  }
  const [s0, e0] = fullSpan;
  const budget = MAX_SOURCE_SENTENCE - 2;
  const half = Math.max(0, Math.floor((budget - (e0 - s0)) / 2));
  let winStart = Math.max(0, s0 - half);
  const winEnd = Math.min(clean.length, winStart + budget);
  if (winEnd - winStart < budget) winStart = Math.max(0, winEnd - budget);
  const prefix = winStart > 0 ? "…" : "";
  const suffix = winEnd < clean.length ? "…" : "";
  const sliced = `${prefix}${clean.slice(winStart, winEnd)}${suffix}`;
  const shiftedStart = s0 - winStart + prefix.length;
  const shiftedEnd = e0 - winStart + prefix.length;
  const span: [number, number] | undefined =
    shiftedStart >= 0 && shiftedEnd <= sliced.length && shiftedStart < shiftedEnd
      ? [shiftedStart, shiftedEnd]
      : findTokenSpan(sliced, candidates);
  return { sentence: sliced, span };
}

function extractTappedFrenchWord(
  container: HTMLElement,
  clientX: number,
  clientY: number,
  fallbackTarget?: Element | null,
): { token: string; context?: LoungeTapContext } | null {
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
  while (start < end && /['’-]/.test(text[start])) start++;
  while (end > start && /['’-]/.test(text[end - 1])) end--;
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
  if (!token || !FRENCH_LETTER_RE.test(token)) return null;
  const context = extractLoungeContext(textNode) ?? extractLoungeContext(fallbackTarget);
  return { token, context };
}

interface PopupState {
  query: string;
  loading: boolean;
  result: ResolveResult | null;
  contextSentence?: string;
  contextSource?: string;
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
  const customWords = useStore((s) => s.progress.custom);
  const readDeck = useStore((s) => s.settings.readDeck);
  const voice = useStore((s) => s.settings.accent);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [formState, setFormState] = useState<{ entry: LexEntry; deckId: string } | null>(null);

  const close = useCallback(() => {
    reqId.current++;
    setPopup(null);
    const el = containerRef?.current ?? internalRef.current;
    const sel = window.getSelection();
    if (el && sel && !sel.isCollapsed && el.contains(sel.anchorNode)) {
      const anchorEl =
        sel.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as Element)
          : sel.anchorNode?.parentElement;
      if (!anchorEl?.closest("input, textarea")) sel.removeAllRanges();
    }
  }, [containerRef]);

  const lookup = useCallback(async (rawText: string, context?: LoungeTapContext) => {
    const query = cleanSelectionText(rawText);
    if (!query || query.length > 60 || !FRENCH_LETTER_RE.test(query)) return;
    const id = ++reqId.current;
    const contextSentence = context?.sentence;
    const contextSource = context?.source;
    setPopup({ query, loading: true, result: null, contextSentence, contextSource });
    try {
      const result = await lookupLexdbWithFallback(query);
      if (reqId.current === id) setPopup({ query, loading: false, result, contextSentence, contextSource });
    } catch {
      if (reqId.current === id) {
        setPopup({ query, loading: false, result: { entries: [], matchedVia: "none" }, contextSentence, contextSource });
      }
    }
  }, []);

  useEffect(() => {
    const el = containerRef?.current ?? internalRef.current;
    if (!el) return;
    el.setAttribute("data-word-popup-zone", "1");

    const isInteractive = (target: Element | null) =>
      !!target?.closest(
        "button, a, input, textarea, select, label, summary, [role='button'], [role='radio'], .rw, .word-popup",
      );

    const checkSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return false;
      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!anchor || !focus || !el.contains(anchor) || !el.contains(focus)) return false;
      const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
      if (anchorEl?.closest("input, textarea, .word-popup")) return false;
      if (anchorEl?.closest("[data-word-popup-zone]") !== el) return false;
      const text = cleanSelectionText(sel.toString());
      if (!text || text.length > 60 || !FRENCH_LETTER_RE.test(text)) return false;
      lastSelectAt.current = Date.now();
      void lookup(text, extractLoungeContext(anchorEl));
      return true;
    };

    const onMouseUp = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (isInteractive(target)) return;
      if (target?.closest("[data-word-popup-zone]") !== el) return;
      window.setTimeout(() => {
        checkSelection();
      }, 12);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as Element | null;
      if (isInteractive(target)) return;
      if (target?.closest("[data-word-popup-zone]") !== el) return;
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
      if (target.closest("[data-word-popup-zone]") !== el) return;
      if (isInteractive(target)) return;
      const tapped = extractTappedFrenchWord(el, e.clientX, e.clientY, target);
      if (tapped) void lookup(tapped.token, tapped.context);
    };

    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("click", onClick);
      el.removeAttribute("data-word-popup-zone");
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

  const deck = decks.find((d) => d.id === readDeck) ?? (!readDeck ? decks.find((d) => d.name === POPUP_DECK) : undefined);
  const deckName = deck?.name ?? POPUP_DECK;
  const targetDeck = () => {
    if (deck) return deck.id;
    const id = decks.find((d) => d.name === POPUP_DECK)?.id ?? createDeck(POPUP_DECK);
    store.settings({ readDeck: id });
    return id;
  };

  const entry = popup?.result?.entries[0] ?? null;
  const atlasMatch = useMemo(
    () => (entry ? (entry.atlasId ? atlas.byId.get(entry.atlasId) : undefined) ?? findExact(atlas, entry.w)[0] : undefined),
    [atlas, entry],
  );
  const savedWordId = useMemo(() => {
    if (atlasMatch) return atlasMatch.id;
    if (!entry || !customWords) return undefined;
    const target = entry.w.trim().toLowerCase();
    return Object.keys(customWords).find((k) => customWords[k].w.trim().toLowerCase() === target);
  }, [atlasMatch, entry, customWords]);
  const inDeck = !!savedWordId && !!deck?.words.includes(savedWordId);

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

            {(entry.forms?.f || entry.forms?.pl || entry.forms?.fpl || entry.conj) && (
              <p className="word-popup-meta muted small">
                {[
                  entry.forms?.f && `f. ${entry.forms.f}`,
                  entry.forms?.pl && `pl. ${entry.forms.pl}`,
                  entry.forms?.fpl && `f.pl. ${entry.forms.fpl}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {entry.conj && (
                  <a className="link small" href={href({ page: "dict", w: entry.w, tab: "conj" })} onClick={close}>
                    动词变位 →
                  </a>
                )}
              </p>
            )}

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

            {(entry.derived?.length || entry.syn?.length || entry.ant?.length) ? (
              <div className="word-popup-rels" aria-label="相关词">
                {(
                  [
                    ["派", entry.derived?.slice(0, 3)],
                    ["近", entry.syn?.slice(0, 2)],
                    ["反", entry.ant?.slice(0, 1)],
                  ] as const
                ).flatMap(([tag, list]) =>
                  (list ?? []).map((w) => (
                    <a key={`${tag}-${w}`} className="dict-rel-chip is-compact" href={href({ page: "dict", w })} onClick={close} title={`查看「${w}」词条`}>
                      <small>{tag}</small>
                      <span lang="fr">{w}</span>
                    </a>
                  )),
                )}
              </div>
            ) : null}

            <div className="word-popup-actions">
              {savedWordId && inDeck ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openWord(savedWordId)}>
                  <Check size={14} /> 已在「{deckName}」
                </button>
              ) : atlasMatch ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const id = targetDeck();
                    if (popup.contextSentence) {
                      const { sentence, span } = prepareLoungeSentence(popup.contextSentence, popup.query, atlasMatch.word);
                      addPicked(
                        id,
                        [
                          {
                            kind: "atlas",
                            id: atlasMatch.id,
                            word: atlasMatch.word,
                            zh: atlasMatch.zh,
                            sentence,
                            span,
                            deckNote: popup.contextSource,
                          },
                        ],
                        true,
                      );
                      if (popup.contextSource) setDeckNote(id, atlasMatch.id, popup.contextSource);
                      const name = store.get().progress.decks?.find((d) => d.id === id)?.name ?? POPUP_DECK;
                      toast(`已连同原句加入「${name}」`, "ok");
                    } else {
                      addToDeck(id, atlasMatch.id);
                      const name = store.get().progress.decks?.find((d) => d.id === id)?.name ?? POPUP_DECK;
                      toast(`已加入「${name}」`, "ok");
                    }
                  }}
                >
                  <Plus size={14} /> 加入生词本 / 复习
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const id = targetDeck();
                    if (popup.contextSentence) {
                      const seed = entryToSeed(entry);
                      if (seed.zh.trim()) {
                        const prevWords = new Set(store.get().progress.decks?.find((d) => d.id === id)?.words ?? []);
                        const { sentence, span } = prepareLoungeSentence(popup.contextSentence, popup.query, entry.w);
                        addPicked(
                          id,
                          [
                            {
                              kind: "dict",
                              word: seed.w,
                              pos: seed.pos,
                              ipa: seed.ipa || undefined,
                              zh: seed.zh,
                              dictEx: seed.ex,
                              note: seed.note || undefined,
                              col: seed.col,
                              fam: seed.fam,
                              syn: seed.syn,
                              ant: seed.ant,
                              sentence,
                              span,
                              deckNote: popup.contextSource,
                            },
                          ],
                          true,
                        );
                        if (popup.contextSource) {
                          const updatedWords = store.get().progress.decks?.find((d) => d.id === id)?.words ?? [];
                          const addedId = updatedWords.find((wId) => !prevWords.has(wId)) ?? updatedWords[updatedWords.length - 1];
                          if (addedId) setDeckNote(id, addedId, popup.contextSource);
                        }
                        const name = store.get().progress.decks?.find((d) => d.id === id)?.name ?? POPUP_DECK;
                        toast(`已连同原句加入「${name}」`, "ok");
                        return;
                      }
                    }
                    setFormState({ entry, deckId: id });
                  }}
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
