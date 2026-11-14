import { useEffect, useState } from "react";

/**
 * A number chosen from a few presets or typed freely (whole numbers from `min` to `max`).
 * The typed value is applied as it becomes valid; an empty or out-of-range entry changes nothing.
 */
export function CountPicker({ value, onChange, presets, min = 1, max, unit = "", label }: { value: number; onChange: (n: number) => void; presets: number[]; min?: number; max: number; unit?: string; label: string }) {
  const custom = !presets.includes(value);
  const [text, setText] = useState(custom ? String(value) : "");
  useEffect(() => {
    if (presets.includes(value)) setText("");
    else setText((t) => (Number(t) === value ? t : String(value)));
    // presets is a constant list for each use
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 5);
    setText(digits);
    const n = Number(digits);
    if (digits && n >= min && n <= max) onChange(n);
  };
  const bad = text !== "" && !(Number(text) >= min && Number(text) <= max);
  return (
    <div className="count-picker">
      <div className="segmented">
        {presets.map((n) => (
          <button key={n} type="button" className={value === n && !text ? "is-on" : ""} aria-pressed={value === n && !text} onClick={() => onChange(n)}>
            {n}
            {unit}
          </button>
        ))}
      </div>
      <label className={`count-custom ${custom || text ? "is-on" : ""} ${bad ? "is-bad" : ""}`}>
        <span>自定</span>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={text} placeholder="…" onChange={(e) => type(e.target.value)} aria-label={`${label}（${min}–${max}）`} />
      </label>
      {bad && (
        <small className="count-note">
          填 {min}–{max} 之间的整数
        </small>
      )}
    </div>
  );
}
