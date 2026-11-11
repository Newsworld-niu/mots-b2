import { BookOpen, ChevronLeft, ChevronRight, Compass, Keyboard, Moon, Search, Sun, User } from "lucide-react";
import { useCallback, useEffect } from "react";
import { WORD_BY_ID, WORD_INDEX, WORD_ORDER } from "./data";
import { closeWord, go, openWord, useRoute, type Page } from "./lib/router";
import { Atlas } from "./pages/Atlas";
import { Learn } from "./pages/Learn";
import { Me } from "./pages/Me";
import { Practice } from "./pages/Practice";
import { Today } from "./pages/Today";
import { EntryView } from "./ui/EntryView";
import { Sheet } from "./ui/Sheet";
import { Logo } from "./ui/Logo";
import { store, useStore } from "./store/store";

const NAV: { page: Page; label: string; icon: typeof Compass }[] = [
  { page: "today", label: "今日", icon: Compass },
  { page: "atlas", label: "词图", icon: BookOpen },
  { page: "practice", label: "练习", icon: Keyboard },
  { page: "me", label: "我的", icon: User },
];

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0D1120" : "#F6F1E7");
  }, [theme]);
  return theme;
}

export default function App() {
  useTheme();
  const { page, params } = useRoute();
  const theme = useStore((s) => s.settings.theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const focus = page === "learn";
  const wordId = params.get("word");

  useEffect(() => {
    if (!wordId) window.scrollTo({ top: 0 });
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`app ${focus ? "is-focus" : ""}`}>
      {!focus && (
        <header className="topbar">
          <a className="topbar-logo" href="#/" aria-label="Mots B2 首页">
            <Logo />
          </a>
          <nav className="topnav" aria-label="主导航">
            {NAV.map(({ page: p, label }) => (
              <a key={p} href={p === "today" ? "#/" : `#/${p}`} className={page === p ? "is-on" : ""} aria-current={page === p ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="topbar-tools">
            <button className="search-pill" onClick={() => go("atlas")} aria-label="搜索法语词">
              <Search size={17} />
              <span>搜索法语词</span>
            </button>
            <button className="icon-btn" onClick={() => store.settings({ theme: dark ? "light" : "dark" })} aria-label={dark ? "切换到浅色" : "切换到深色"}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
      )}

      <main className="main" id="main">
        {page === "today" && <Today />}
        {page === "atlas" && <Atlas />}
        {page === "learn" && <Learn />}
        {page === "practice" && <Practice />}
        {page === "me" && <Me />}
      </main>

      {!focus && (
        <footer className="footer">
          <Logo compact />
          <p>
            Apprendre le français, un mot à la fois · 法语 B2 词图 · 数据为原创学习内容，仍需人工校对
          </p>
        </footer>
      )}

      {!focus && (
        <nav className="tabbar" aria-label="主导航">
          {NAV.map(({ page: p, label, icon: Icon }) => (
            <a key={p} href={p === "today" ? "#/" : `#/${p}`} className={page === p ? "is-on" : ""} aria-current={page === p ? "page" : undefined}>
              <Icon size={22} strokeWidth={page === p ? 2.1 : 1.7} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      )}

      <WordSheet id={wordId} />
    </div>
  );
}

function WordSheet({ id }: { id: string | null }) {
  const entry = id ? WORD_BY_ID.get(id) : undefined;
  const ref = id ? WORD_INDEX.get(id) : undefined;
  const neighbor = useCallback(
    (d: number) => {
      if (ref === undefined) return;
      const n = WORD_ORDER[ref + d];
      if (n) openWord(n.id);
    },
    [ref],
  );
  useEffect(() => {
    if (!id) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") neighbor(-1);
      if (e.key === "ArrowRight") neighbor(1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [id, neighbor]);
  return (
    <Sheet open={!!entry} onClose={closeWord} label={entry ? `${entry.w} 词条` : "词条"}>
      {entry && <EntryView key={entry.id} entry={entry} />}
      {entry && ref !== undefined && (
        <nav className="sheet-nav" aria-label="切换词条">
          <button className="icon-btn" onClick={() => neighbor(-1)} disabled={ref === 0} aria-label="上一个">
            <ChevronLeft size={20} />
          </button>
          <span>
            {ref + 1} / {WORD_ORDER.length}
          </span>
          <button className="icon-btn" onClick={() => neighbor(1)} disabled={ref >= WORD_ORDER.length - 1} aria-label="下一个">
            <ChevronRight size={20} />
          </button>
        </nav>
      )}
    </Sheet>
  );
}
