/** 原文生词入库: list the words of a transcript the learner has not learned yet and add the ticked ones to a deck at once. */
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAtlas } from "../atlas/context";
import { joinGlosses, lookupDict } from "../lib/dict";
import { annotate } from "../lib/reader";
import { newWordsOf, type TranscriptWord } from "../lib/transcript";
import { addPicked, createDeck, MAX_SOURCE_SENTENCE, type PickedWord } from "../store/decks";
import { store, useStore } from "../store/store";
import { toast } from "./Toast";

export const LISTEN_DECK = "听力生词";

const keyOf = (w: TranscriptWord) => w.tok.id ?? `d:${w.tok.hit?.w ?? w.tok.t}`;

export function TranscriptWords({ text, deckName = LISTEN_DECK, onClose }: { text: string; deckName?: string; onClose: () => void }) {
  const atlas = useAtlas();
  const cards = useStore((s) => s.progress.cards);
  const decks = useStore((s) => s.progress.decks) ?? [];
  const [words, setWords] = useState<TranscriptWord[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    void annotate(text, atlas, () => "new", lookupDict).then((paras) => {
      if (!live) return;
      const list = newWordsOf(paras, (id) => !!store.get().progress.cards[id]);
      setWords(list);
      // words only the dictionary knows are often names or rare forms: unticked to begin with
      setOff(new Set(list.filter((w) => !w.atlas).map(keyOf)));
    });
    return () => {
      live = false;
    };
  }, [text, atlas]);

  const deck = decks.find((d) => d.name === deckName);
  const inDeck = useMemo(() => new Set(deck?.words ?? []), [deck]);
  const shown = (words ?? []).filter((w) => !(w.tok.id && (inDeck.has(w.tok.id) || cards[w.tok.id])));
  const chosen = shown.filter((w) => !off.has(keyOf(w)));

  const add = () => {
    const id = deck?.id ?? createDeck(deckName);
    const picked: PickedWord[] = chosen.map((w) => {
      const sentence = w.sentence.length <= MAX_SOURCE_SENTENCE ? w.sentence : "";
      const span: [number, number] | undefined = sentence ? [w.tok.s, w.tok.e] : undefined;
      const ref = w.tok.id ? atlas.byId.get(w.tok.id) : undefined;
      return ref
        ? { kind: "atlas", id: ref.id, word: ref.word, zh: ref.zh, sentence, span }
        : {
            kind: "dict",
            word: w.tok.hit!.w,
            pos: w.tok.hit!.p,
            ipa: w.tok.hit!.ipa,
            zh: joinGlosses(w.tok.hit!.zh ?? []),
            sentence,
            span,
            dictEx: (w.tok.hit!.ex ?? []).slice(0, 1).map(([fr, zh, a, b]) => ({ fr, zh, src: "tatoeba" as const, hl: [a, b] as [number, number] })),
          };
    });
    const { added, skipped } = addPicked(id, picked, true);
    toast(`已把 ${added} 个词加入「${deckName}」，原句存为例句${skipped ? `；${skipped} 个没有中文释义，没有加入` : ""}`);
    onClose();
  };

  return (
    <div className="panel transcript-words">
      <header className="exam-doc-actions">
        <strong>原文生词</strong>
        <span className="muted small">没有记忆卡片的词；勾选后一次加进「{deckName}」，原句作为例句。</span>
        <button className="link" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
      </header>
      {!words ? (
        <p className="muted">正在查词…</p>
      ) : !shown.length ? (
        <p className="muted">这篇里没有新词：都已经在学或已在卡组里。</p>
      ) : (
        <>
          <ul className="transcript-list">
            {shown.map((w) => {
              const k = keyOf(w);
              const ref = w.tok.id ? atlas.byId.get(w.tok.id) : undefined;
              const zh = ref?.zh ?? joinGlosses(w.tok.hit?.zh ?? [], 2);
              return (
                <li key={k}>
                  <label>
                    <input type="checkbox" checked={!off.has(k)} onChange={(e) => setOff((s) => { const n = new Set(s); if (e.target.checked) n.delete(k); else n.add(k); return n; })} />
                    <span lang="fr">{ref?.word ?? w.tok.hit?.w ?? w.tok.t}</span>
                    <span className="muted small">{zh || "（无中文释义）"}{w.n > 1 ? ` · ×${w.n}` : ""}{ref ? "" : " · 词典"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="exam-doc-actions">
            <button className="link" onClick={() => setOff(new Set())}>全选</button>
            <button className="link" onClick={() => setOff(new Set(shown.map(keyOf)))}>全不选</button>
            <button className="btn btn-primary" onClick={add} disabled={!chosen.length}>
              <Plus size={16} /> 加入 {chosen.length} 个词
            </button>
          </div>
        </>
      )}
    </div>
  );
}
