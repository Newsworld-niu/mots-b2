import { useEffect, useState } from "react";
import { isNative } from "../lib/native";

const BUNDLE = /assets\/index-[\w-]+\.js/;

/**
 * 有新版本: the page that is open keeps running the files it was loaded with. When the tab comes back into view,
 * ask the server for the current index.html; if it names another bundle, offer to reload (never on its own:
 * a lesson may be under way).
 */
export function UpdateNote() {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const mine = [...document.scripts].map((s) => s.src.match(BUNDLE)?.[0]).find(Boolean);
    // npm run dev serves no bundle, and the app ships its files inside the package
    if (!mine || isNative()) return;
    let last = 0;
    let live = true;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: "no-store" });
        const now = r.ok ? (await r.text()).match(BUNDLE)?.[0] : undefined;
        if (live && now && now !== mine) setFresh(true);
      } catch {
        /* offline: ask again next time */
      }
    };
    const timer = window.setInterval(check, 5 * 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  if (!fresh) return null;
  return (
    <div className="update-note" role="status">
      网站有新版本
      <button onClick={() => location.reload()}>刷新</button>
    </div>
  );
}
