import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm {
  id: number;
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

let seq = 1;
const queue: PendingConfirm[] = [];
const listeners = new Set<() => void>();
let testHandler: ((opts: ConfirmOptions) => Promise<boolean> | boolean) | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

/** Override confirmation resolution in headless unit tests. Pass null to restore. */
export function setConfirmTestHandler(fn: ((opts: ConfirmOptions) => Promise<boolean> | boolean) | null) {
  testHandler = fn;
}

/**
 * Open an accessible in-app Sheet confirmation dialog (replacing native window.confirm()).
 * Resolves true when confirmed, false when cancelled or closed.
 */
export function confirmAction(opts: ConfirmOptions | string): Promise<boolean> {
  const normalized: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  if (testHandler) return Promise.resolve(testHandler(normalized));
  if (listeners.size === 0) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    queue.push({ id: seq++, opts: normalized, resolve });
    notify();
  });
}

function popHead(ok: boolean) {
  const cur = queue.shift();
  if (cur) cur.resolve(ok);
  notify();
}

/** Host component mounted once in AppShell to render active confirmation sheets. */
export function ConfirmSheetHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    listeners.add(bump);
    bump();
    return () => {
      listeners.delete(bump);
    };
  }, []);

  const head = queue[0] ?? null;
  if (!head) return null;
  const { title = "确认操作", message, confirmLabel = "确认", cancelLabel = "取消", danger = false } = head.opts;

  return (
    <Sheet open onClose={() => popHead(false)} label={title} className="confirm-sheet">
      <h2 className="sheet-title">{title}</h2>
      <p className="confirm-sheet-body">{message}</p>
      <div className="confirm-sheet-actions">
        <button type="button" className="btn btn-ghost" onClick={() => popHead(false)}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn ${danger ? "btn-terra" : "btn-primary"}`} onClick={() => popHead(true)} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
