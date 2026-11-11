import { useState, type RefObject } from "react";
import { ACCENT_KEYS, insertAt } from "../lib/accent";

/** Row of French accent keys under a text input. Keeps the input focused and inserts at the caret. */
export function AccentKeys({ input, value, onChange }: { input: RefObject<HTMLInputElement | HTMLTextAreaElement | null>; value: string; onChange: (next: string) => void }) {
  const [upper, setUpper] = useState(false);
  const put = (ch: string) => {
    const el = input.current;
    const out = insertAt(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, upper ? ch.toUpperCase() : ch);
    onChange(out.value);
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(out.caret, out.caret);
    });
  };
  return (
    <div className="accent-keys" role="group" aria-label="法语重音符号">
      {ACCENT_KEYS.map((ch) => (
        <button key={ch} type="button" className="accent-key" lang="fr" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => put(ch)} aria-label={`输入 ${ch}`}>
          {upper ? ch.toUpperCase() : ch}
        </button>
      ))}
      <button type="button" className={`accent-key accent-shift ${upper ? "is-on" : ""}`} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => setUpper((u) => !u)} aria-pressed={upper} aria-label="大写">
        ⇧
      </button>
    </div>
  );
}
