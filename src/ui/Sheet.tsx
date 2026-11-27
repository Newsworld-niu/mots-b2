import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Open sheets, bottom to top. Sheets can stack (a word sheet over the dictionary, a confirm over a form): only the
 * topmost one answers Escape and traps Tab, and the page stays locked until the last one closes.
 */
const openStack: symbol[] = [];

const isTop = (token: symbol) => openStack[openStack.length - 1] === token;

/** How many sheets are open now (for tests and the shell). */
export const openSheetCount = () => openStack.length;

/** Accessible dialog: centered panel on desktop, bottom sheet on phones. */
export function Sheet({
  open,
  onClose,
  label,
  children,
  wide = false,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // The latest onClose without re-running the effect below: callers pass a new function on every render, and
  // re-running would move the focus back to the panel while someone is typing in a field.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const token = Symbol("sheet");
    const prev = document.activeElement as HTMLElement | null;
    openStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (!isTop(token)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
        return;
      }
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) {
          e.preventDefault();
          panel.current.focus({ preventScroll: true });
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        const inside = panel.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("is-locked");
    const raf = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      const at = openStack.indexOf(token);
      if (at >= 0) openStack.splice(at, 1);
      if (openStack.length === 0) document.documentElement.classList.remove("is-locked");
      // Give the focus back to what opened this layer (when it is still on the page).
      if (prev && prev.isConnected) prev.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  // Rendered on <body>: a transformed or animated page ancestor would otherwise
  // become the containing block and the dialog would scroll with the page.
  return createPortal(
    <div className="sheet-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className={`sheet ${wide ? "sheet-wide" : ""} ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <span className="sheet-grip" aria-hidden="true" />
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
