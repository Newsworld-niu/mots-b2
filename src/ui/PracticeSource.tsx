import { Check } from "lucide-react";
import { PRACTICE_SOURCES, type PracticeSource } from "../lib/practice-source";

/** Shared by word practice and conjugation so their source choices stay consistent. */
export function PracticeSourcePicker({ source, onSource, decks, chosenDecks, onDeck }: {
  source: PracticeSource;
  onSource: (source: PracticeSource) => void;
  decks: { id: string; name: string }[];
  chosenDecks: readonly string[];
  onDeck: (id: string) => void;
}) {
  return <>
    <h3 className="eyebrow">词来自</h3>
    <div className="segmented segmented-wide practice-sources" role="group" aria-label="词来自">
      {PRACTICE_SOURCES.map(([key, label]) => <button key={key} className={source === key ? "is-on" : ""} onClick={() => onSource(key)} aria-pressed={source === key}>{label}</button>)}
    </div>
    {source === "decks" && <ul className="chips practice-decks" role="group" aria-label="从哪些卡组出题">
      {decks.map(deck => {
        const on = chosenDecks.includes(deck.id);
        return <li key={deck.id}><button className={`chip-btn ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => onDeck(deck.id)}>{on && <Check size={14} />} {deck.name}</button></li>;
      })}
    </ul>}
  </>;
}
