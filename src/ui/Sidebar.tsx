import { Info, Keyboard, Moon, Search, Sun } from "lucide-react";
import { useMemo } from "react";
import type { Route } from "../lib/router";
import { useMistakeDue } from "../store/grammar-due";
import { dueIds } from "../store/session";
import { store, useStoreShallow } from "../store/store";
import { AmbiencePicker } from "./Ambience";
import { Logo } from "./Logo";
import { MAIN_NAV, navOn, searchShortcutLabel } from "./nav";

/** A small count after a link, only when there is something to do. */
function Badge({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span className="side-badge" aria-label={`${label} ${n}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Desktop (≥960px) navigation: a Mac-style source list. Every pillar is listed; only the active pillar shows its
 * sub-pages, so the list stays short. Counts mark due reviews and the mistakes waiting in 错题中心.
 */
export function Sidebar({ page, dark, onSearch, onShortcuts }: { page: Route["page"]; dark: boolean; onSearch: () => void; onShortcuts: () => void }) {
  const p = useStoreShallow((s) => ({
    cards: s.progress.cards,
    suspendedLeeches: s.progress.suspendedLeeches,
    mistakes: s.progress.mistakes,
    noteCards: s.progress.noteCards,
    essayNotes: s.progress.essayNotes,
    compMisses: s.progress.compMisses,
  }));
  const { cards, suspendedLeeches } = p;
  const due = useMemo(() => dueIds({ cards, suspendedLeeches }).length, [cards, suspendedLeeches]);
  const mistakes = useMistakeDue(p).total;
  const counts: Partial<Record<Route["page"], [number, string]>> = {
    today: [due, "到期复习"],
    decks: [due, "到期复习"],
    reflow: [mistakes, "待回流错题"],
  };
  const shortcut = useMemo(searchShortcutLabel, []);
  return (
    <aside className="sidebar" aria-label="侧边导航">
      <a className="sidebar-logo" href="#/" aria-label="法语词光首页">
        <Logo />
      </a>
      <button type="button" className="sidebar-search" onClick={onSearch} aria-label="搜索单词" aria-keyshortcuts="Meta+K Control+K /">
        <Search size={15} />
        <span>搜索单词</span>
        <kbd>{shortcut}</kbd>
      </button>
      <nav className="sidebar-nav" aria-label="主导航">
        {MAIN_NAV.map(({ page: g, label, href, icon: Icon, sub }) => {
          const groupOn = navOn(page, g);
          const badge = counts[g];
          return (
            <div key={g} className={`side-group ${groupOn ? "is-open" : ""}`}>
              <a href={href} className={`side-link ${page === g ? "is-on" : groupOn ? "is-within" : ""}`} aria-current={page === g ? "page" : undefined}>
                <Icon size={17} strokeWidth={page === g || groupOn ? 2.1 : 1.8} />
                <span>{label}</span>
                {badge && <Badge n={badge[0]} label={badge[1]} />}
              </a>
              {groupOn && sub.length > 0 && (
                <ul className="side-sub">
                  {sub.map((s) => {
                    const b = counts[s.page];
                    return (
                      <li key={s.page}>
                        <a href={s.href} className={page === s.page ? "is-on" : ""} aria-current={page === s.page ? "page" : undefined}>
                          <span>{s.label}</span>
                          {b && <Badge n={b[0]} label={b[1]} />}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <AmbiencePicker />
        <button className="icon-btn" onClick={() => store.settings({ theme: dark ? "light" : "dark" })} aria-label={dark ? "切换到浅色" : "切换到深色"} title={dark ? "浅色" : "深色"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a className="icon-btn" href="#/about" aria-label="关于与开源" title="关于与开源">
          <Info size={18} />
        </a>
        <button type="button" className="sidebar-keys" onClick={onShortcuts} aria-label="键盘快捷键" aria-keyshortcuts="Shift+?" title="键盘快捷键（?）">
          <Keyboard size={15} />
          <kbd>?</kbd>
          <span>快捷键</span>
        </button>
      </div>
    </aside>
  );
}
