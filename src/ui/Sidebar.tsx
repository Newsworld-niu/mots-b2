import { Info, Moon, Search, Sun } from "lucide-react";
import type { Route } from "../lib/router";
import { store } from "../store/store";
import { AmbiencePicker } from "./Ambience";
import { Logo } from "./Logo";
import { MAIN_NAV, navOn } from "./nav";

/** Desktop (≥960px) navigation: a Mac-style source list with every pillar and its main destinations. */
export function Sidebar({ page, dark, onSearch }: { page: Route["page"]; dark: boolean; onSearch: () => void }) {
  return (
    <aside className="sidebar" aria-label="侧边导航">
      <a className="sidebar-logo" href="#/" aria-label="法语词光首页">
        <Logo />
      </a>
      <button type="button" className="sidebar-search" onClick={onSearch} aria-label="搜索单词">
        <Search size={15} />
        <span>搜索单词</span>
        <kbd>⌘K</kbd>
      </button>
      <nav className="sidebar-nav" aria-label="主导航">
        {MAIN_NAV.map(({ page: p, label, href, icon: Icon, sub }) => {
          const groupOn = navOn(page, p);
          return (
            <div key={p} className={`side-group ${groupOn ? "is-open" : ""}`}>
              <a href={href} className={`side-link ${page === p ? "is-on" : groupOn ? "is-within" : ""}`} aria-current={page === p ? "page" : undefined}>
                <Icon size={17} strokeWidth={page === p || groupOn ? 2.1 : 1.8} />
                <span>{label}</span>
              </a>
              {sub.length > 0 && (
                <ul className="side-sub">
                  {sub.map((s) => (
                    <li key={s.page}>
                      <a href={s.href} className={page === s.page ? "is-on" : ""} aria-current={page === s.page ? "page" : undefined}>
                        {s.label}
                      </a>
                    </li>
                  ))}
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
      </div>
    </aside>
  );
}
