import { useState } from "react";

/** Topic hues for words without a gender. Blue and plum are left out: on a text plate they mean masculine / feminine. */
const HUES = ["#C4573A", "#7F9B77", "#D9A03A", "#4E7C76", "#8A7A5C"];
/** Plate colours for nouns, the same blue / plum as the un / une chips (light values: the plate is always paper). */
const GENDER_HUE: Record<string, string> = { un: "#4f7899", une: "#9a6283", "un/une": "#6f6f8f" };

/** Article for a noun's text plate, from an entry's `art` or an index row's quiz gender. */
export const plateArticle = (w: { art?: string; g?: "m" | "f" }) => w.art ?? (w.g === "m" ? "un" : w.g === "f" ? "une" : undefined);

/** Square illustration with a typographic plate as an intentional fallback. Nouns' plates are coloured by gender. */
export function Illustration({
  src,
  word,
  topic = 0,
  className = "",
  eager = false,
  alt,
  art,
}: {
  src: string | null;
  word: string;
  topic?: number;
  className?: string;
  eager?: boolean;
  alt?: string;
  /** "un" | "une" | "un/une": colours the text plate and prints the article above the word. */
  art?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const showImg = src && state !== "error";
  const hue = (art && GENDER_HUE[art]) || HUES[((topic % HUES.length) + HUES.length) % HUES.length];
  return (
    <figure className={`illo ${showImg && state === "ok" ? "is-loaded" : ""} ${className}`}>
      {showImg ? (
        <img
          src={src}
          alt={alt ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
        />
      ) : (
        <div className="plate" style={{ "--hue": hue, "--len": Math.max(4, word.length) } as React.CSSProperties} aria-hidden="true">
          <span className="plate-initial">{word.slice(0, 1)}</span>
          {art && GENDER_HUE[art] && <span className="plate-art">{art}</span>}
          <span className="plate-word">{word}</span>
          <i className="plate-rule" />
        </div>
      )}
    </figure>
  );
}
