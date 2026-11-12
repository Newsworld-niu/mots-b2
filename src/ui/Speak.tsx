import { Volume2 } from "lucide-react";
import { useState } from "react";
import { ready, useAiConfig } from "../ai/config";
import { play } from "../lib/audio";

export function Speak({
  url,
  text,
  accent = "uk",
  label,
  size = "md",
  rate = 1,
  className = "",
  kbd,
  ariaLabel,
  onPlay,
}: {
  url: string | null;
  text: string;
  accent?: "uk" | "us";
  label?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  rate?: number;
  className?: string;
  kbd?: string;
  /** Spoken name of the button when the label is not plain text (e.g. "女声朗读 être"). */
  ariaLabel?: string;
  onPlay?: () => void;
}) {
  const [on, setOn] = useState(false);
  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.();
    setOn(true);
    try {
      await play(url, text, accent, rate);
    } finally {
      setOn(false);
    }
  };
  return (
    <button
      type="button"
      className={`speak speak-${size} ${on ? "is-on" : ""} ${label ? "has-label" : ""} ${className}`}
      onClick={run}
      aria-label={ariaLabel ?? (typeof label === "string" ? `朗读 ${label}` : `朗读 ${text}`)}
      title={kbd ? `朗读（${kbd}）` : "朗读"}
    >
      <span className="speak-icon">
        <Volume2 size={size === "lg" ? 22 : size === "sm" ? 15 : 18} strokeWidth={1.8} />
        <span className="speak-waves" />
      </span>
      {label && <span className="speak-label">{label}</span>}
    </button>
  );
}

/**
 * Speech for a text that has no recording: a female and a male button when Azure reads such texts (each voice is
 * made once and kept), a single button for the device voice otherwise.
 */
export function SpeakBoth({ text, size = "sm", className = "", lead }: { text: string; size?: "sm" | "md" | "lg"; className?: string; lead?: React.ReactNode }) {
  const ai = useAiConfig();
  if (!ready.tts(ai)) return <Speak url={null} text={text} size={size} className={className} label={lead} />;
  return (
    <span className={`ex-voices ${className}`}>
      {(["uk", "us"] as const).map((v) => (
        <Speak
          key={v}
          url={null}
          text={text}
          accent={v}
          size={size}
          ariaLabel={`${v === "uk" ? "女" : "男"}声朗读 ${text}`}
          label={
            <>
              <em>{v === "uk" ? "女" : "男"}</em>
              {v === "uk" && lead}
            </>
          }
        />
      ))}
    </span>
  );
}
