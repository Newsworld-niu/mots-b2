import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Sheet({ open, label, onClose, children }: { open: boolean; label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    document.documentElement.classList.add("is-locked");
    return () => {
      window.removeEventListener("keydown", on);
      document.documentElement.classList.remove("is-locked");
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet">
        <button className="icon-btn sheet-close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
