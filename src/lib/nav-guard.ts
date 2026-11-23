import { useEffect, useRef } from "react";

const guards = new Map<symbol, string>();

/** Returns the active leave-confirmation prompt, or null when navigation is safe. */
export function activeNavGuard(): string | null {
  let latest: string | null = null;
  for (const msg of guards.values()) latest = msg;
  return latest;
}

/**
 * Guard active sessions/exams against accidental navigation away or tab close.
 * Binds `beforeunload` and registers an in-app route-transition message while `active` is true.
 */
export function useNavGuard(active: boolean, message: string): void {
  const keyRef = useRef<symbol | null>(null);
  if (!keyRef.current) keyRef.current = Symbol("nav-guard");

  useEffect(() => {
    const key = keyRef.current!;
    if (!active) {
      guards.delete(key);
      return;
    }
    guards.set(key, message);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    if (typeof window !== "undefined") window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      guards.delete(key);
      if (typeof window !== "undefined") window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, message]);
}
