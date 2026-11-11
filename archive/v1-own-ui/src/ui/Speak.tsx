import { Volume2 } from "lucide-react";
import { useState } from "react";
import { speakFr } from "../lib/speech";
import { store } from "../store/store";

/** Button that reads French text aloud with the browser voice. */
export function Speak({ text, label = "听", size = "md" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [silent, setSilent] = useState(false);
  return (
    <button
      className={`speak speak-${size}`}
      onClick={(e) => {
        e.stopPropagation();
        const ok = speakFr(text, store.get().settings.rate);
        setSilent(!ok);
      }}
      aria-label={`朗读：${text}`}
      title={silent ? "当前浏览器没有法语语音" : "朗读"}
    >
      <Volume2 size={size === "sm" ? 15 : 18} />
      <span>{silent ? "无语音" : label}</span>
    </button>
  );
}
