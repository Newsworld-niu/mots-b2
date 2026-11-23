import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A stopwatch or countdown in whole seconds. `start(n)` counts down from n (0 when it ends, and stays there);
 * `start()` counts up from 0. Based on the clock, so a throttled background tab does not drift.
 */
export function useTimer() {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const base = useRef({ t0: 0, from: 0, down: false });
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const gone = Math.floor((Date.now() - base.current.t0) / 1000);
      if (!base.current.down) return setSec(gone);
      const left = Math.max(0, base.current.from - gone);
      setSec(left);
      if (left === 0) setRunning(false);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running]);
  const start = useCallback((from?: number, elapsed = 0) => {
    const safeElapsed = Math.max(0, Math.floor(elapsed));
    base.current = { t0: Date.now() - safeElapsed * 1000, from: from ?? 0, down: from !== undefined };
    setSec(from !== undefined ? Math.max(0, from - safeElapsed) : safeElapsed);
    setRunning(true);
  }, []);
  const stop = useCallback(() => setRunning(false), []);
  return { sec, running, start, stop, down: base.current.down };
}
