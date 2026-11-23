import type React from "react";
import { MEDIA, type Entry, type WordRef } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { liaisonPoints } from "../lib/liaison";
import { splitHighlight, type Span } from "../lib/text";
import { Speak, SpeakBoth } from "./Speak";

const VOICE_LABEL = { uk: "女", us: "男" } as const;

export function Highlight({ text, word, span }: { text: string; word: string; span?: Span | null }) {
  const parts = splitHighlight(text, word, span);
  const points = liaisonPoints(text);
  if (!parts) return <>{withLiaison(text, 0, points)}</>;
  return (
    <>
      {withLiaison(parts[0], 0, points)}
      <mark>{withLiaison(parts[1], parts[0].length, points)}</mark>
      {withLiaison(parts[2], parts[0].length + parts[1].length, points)}
    </>
  );
}

/** `piece` (which starts at `offset` in the sentence) with each liaison space drawn as a ‿ tie. */
function withLiaison(piece: string, offset: number, points: number[]) {
  const here = points.filter((p) => p >= offset && p < offset + piece.length).map((p) => p - offset);
  if (!here.length) return piece;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const p of here) {
    out.push(
      piece.slice(last, p),
      <span key={p} className="liaison" title="连诵">
        <span aria-hidden="true">‿</span>
        <span className="sr-space"> </span>
      </span>,
    );
    last = p + 1;
  }
  out.push(piece.slice(last));
  return out;
}

/**
 * The headword's pronunciation. When both recordings exist the card offers 女 and 男 side by side, as the English
 * atlas offers 英 and 美.
 */
export function Pronounce({ entry, refw }: { entry: Entry; refw: WordRef | Entry }) {
  const atlas = useAtlas();
  const ipa = entry.uk || entry.us;
  const m = "media" in refw && typeof refw.media === "number" ? refw.media : (refw as Entry).m;
  const voices = (["uk", "us"] as const).filter((v) => m & MEDIA[v]);
  if (!voices.length)
    return (
      <div className="pron">
        <SpeakBoth text={entry.w} lead={ipa ? <span className="ipa">{ipa}</span> : undefined} />
      </div>
    );
  if (voices.length < 2)
    return (
      <div className="pron">
        <Speak url={atlas.audio(refw, "uk")} text={entry.w} size="sm" label={ipa ? <span className="ipa">{ipa}</span> : <em>朗读</em>} />
      </div>
    );
  return (
    <div className="pron">
      {voices.map((v) => (
        <Speak
          key={v}
          url={atlas.audio(refw, v)}
          text={entry.w}
          accent={v}
          size="sm"
          ariaLabel={`${VOICE_LABEL[v]}声朗读 ${entry.w}`}
          label={
            <>
              <em>{VOICE_LABEL[v]}</em>
              {v === "uk" && ipa && <span className="ipa">{ipa}</span>}
            </>
          }
        />
      ))}
    </div>
  );
}
