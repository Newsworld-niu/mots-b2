import { useEffect, useRef } from "react";
import { currentLocation } from "./router";

/** Page-level shortcuts that ignore typing in inputs (except readOnly Enter). */
export function useKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // a word sheet is open on top of the session: leave its keys alone
      if (currentLocation().word) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (typing && !(e.key === "Enter" && (t as HTMLInputElement).readOnly)) return;
      if ((t.tagName === "BUTTON" || t.tagName === "SUMMARY") && (e.key === "Enter" || e.key === " ")) return;
      if (t.tagName === "A" && e.key === "Enter") return;
      const fn = ref.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
