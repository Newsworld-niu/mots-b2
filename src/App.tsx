import { migrateCoreDeck } from "./store/decks";
import { ChevronLeft, ChevronRight, Github, Moon, Search, Sun } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AtlasContext, useAtlas, useEntry } from "./atlas/context";
import { loadOpenAtlas } from "./atlas/data";
import { withUserData } from "./atlas/merge";
import { loadImages, useImages } from "./store/images";
import type { Atlas } from "./atlas/types";
import { REPO_URL } from "./config";
import { closeWord, currentLocation, go, openWord, useLocation } from "./lib/router";
import { Today } from "./pages/Today";
import { cue } from "./lib/sound";
import { downloadBackupFile } from "./lib/backup";
import { store, useStore } from "./store/store";
import { useSyncState } from "./sync/state";
import { AmbienceController, AmbiencePicker } from "./ui/Ambience";
import { MAIN_NAV, navOn, searchShortcutLabel } from "./ui/nav";
import { Sidebar } from "./ui/Sidebar";

const Onboarding = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const EntryView = lazy(() => import("./ui/EntryView").then((m) => ({ default: m.EntryView })));
const Palette = lazy(() => import("./ui/Palette").then((m) => ({ default: m.Palette })));
const Splash = lazy(() => import("./ui/Splash").then((m) => ({ default: m.Splash })));
const ShortcutsSheet = lazy(() => import("./ui/ShortcutsSheet").then((m) => ({ default: m.ShortcutsSheet })));
const SyncConflictDialog = lazy(() => import("./ui/SyncConflictDialog").then((m) => ({ default: m.SyncConflictDialog })));
import { ConfirmSheetHost } from "./ui/ConfirmSheet";
import { Logo } from "./ui/Logo";
import { Sheet } from "./ui/Sheet";
import { Toasts } from "./ui/Toast";
import { UpdateNote } from "./ui/UpdateNote";

const AtlasPage = lazy(() => import("./pages/Atlas").then((m) => ({ default: m.AtlasPage })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Learn = lazy(() => import("./pages/Learn").then((m) => ({ default: m.Learn })));
const Me = lazy(() => import("./pages/Me").then((m) => ({ default: m.Me })));
const Practice = lazy(() => import("./pages/Practice").then((m) => ({ default: m.Practice })));
const Read = lazy(() => import("./pages/Read").then((m) => ({ default: m.Read })));
const Conj = lazy(() => import("./pages/Conj").then((m) => ({ default: m.Conj })));
const Grammar = lazy(() => import("./pages/Grammar").then((m) => ({ default: m.Grammar })));
const Compare = lazy(() => import("./pages/Compare").then((m) => ({ default: m.Compare })));
const Decks = lazy(() => import("./pages/Decks").then((m) => ({ default: m.Decks })));
const Dict = lazy(() => import("./pages/Dict").then((m) => ({ default: m.Dict })));
const MockExam = lazy(() => import("./pages/MockExam").then((m) => ({ default: m.MockExam })));
const SpeakingStudio = lazy(() => import("./pages/Speaking").then((m) => ({ default: m.SpeakingStudio })));
const ComprehensionStudio = lazy(() => import("./pages/Comprehension").then((m) => ({ default: m.ComprehensionStudio })));
const EssayStudio = lazy(() => import("./pages/Essay").then((m) => ({ default: m.EssayStudio })));
const RealListening = lazy(() => import("./pages/RealListening").then((m) => ({ default: m.RealListening })));
const DrillStudio = lazy(() => import("./pages/Drill").then((m) => ({ default: m.DrillStudio })));
const ExprStudio = lazy(() => import("./pages/Expressions").then((m) => ({ default: m.ExprStudio })));
const MistakeReflow = lazy(() => import("./pages/MistakeReflow").then((m) => ({ default: m.MistakeReflow })));
const Lounge = lazy(() => import("./pages/Lounge").then((m) => ({ default: m.Lounge })));

/** Same key as ui/Splash.tsx; decided here so the splash chunk loads only when it will show. */
const SPLASH_SEEN_KEY = "word-atlas:splash";

/** Show the animated door splash on the first visit only (unless disabled or deep-linked). */
function shouldShowSplash() {
  if (!store.get().settings.splash) return false;
  const h = location.hash.replace(/^#\/?/, "");
  if (h && !h.startsWith("?")) return false; // deep links go straight to content
  try {
    return !localStorage.getItem(SPLASH_SEEN_KEY);
  } catch {
    return true;
  }
}

/** Keys typed into a field never trigger the global shortcuts. */
function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || !!el.closest?.("[contenteditable='true'],[contenteditable='']");
}

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0F1115" : "#F5F3EF");
  }, [theme]);
  return theme;
}

export default function App() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [open, setOpen] = useState<Atlas | null>(null);
  const [priv] = useState<Atlas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataset = useStore((s) => s.settings.dataset);
  useTheme();

  useEffect(() => {
    loadOpenAtlas().then(
      (a) => {
        setOpen(a);
        },
      (e: Error) => setError(e.message),
    );
  }, []);

  useEffect(() => {
    const next = dataset === "private" && priv ? priv : open;
    if (next && next !== atlas) {
      store.useDataset(next.id);
      // duplicate ids (aliases) move their records to the primary id; snapshot first, idempotent
      store.migrateAliases(next.aliases ?? {});
      migrateCoreDeck(next);
      setAtlas(next);
    }
  }, [dataset, open, priv, atlas]);

  if (error)
    return (
      <div className="boot">
        <Logo />
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    );
  if (!atlas)
    return (
      <div className="boot" aria-busy="true">
        <Logo />
        <span className="spinner" />
      </div>
    );
  return <WithUserData base={atlas} />;
}

/** The atlas plus the learner's own words and edits; rebuilt only when those change. */
function WithUserData({ base }: { base: Atlas }) {
  const coreMigrated = useStore((s) => s.progress.coreMigrated);
  useEffect(() => {
    if (!coreMigrated) migrateCoreDeck(base);
  }, [base, coreMigrated]);
  const custom = useStore((s) => s.progress.custom);
  const edits = useStore((s) => s.progress.edits);
  const images = useImages();
  useEffect(() => {
    void loadImages(base.id);
  }, [base.id]);
  const atlas = useMemo(() => withUserData(base, custom, edits, images), [base, custom, edits, images]);
  if (!coreMigrated) return <div className="loading"><span className="spinner" /></div>;
  return (
    <AtlasContext.Provider value={atlas}>
      <Shell />
    </AtlasContext.Provider>
  );
}

function Shell() {
  const { route, word } = useLocation();
  const atlas = useAtlas();
  // an old link to an alias opens its primary entry
  const target = word && atlas.aliases?.[word] ? atlas.aliases[word] : word;
  useEffect(() => {
    if (word && target && target !== word) go(route, target, true);
  }, [word, target, route]);
  const onboarded = useStore((s) => s.settings.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const saveError = useStore((s) => s.saveError);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [splash, setSplash] = useState(shouldShowSplash);
  const shortcutLabel = useMemo(searchShortcutLabel, []);
  const syncConflict = useSyncState().conflict;
  const focus = route.page === "learn";
  const immersiveLounge = route.page === "lounge" && Boolean(route.item);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const typing = isTypingTarget(e.target);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "/" && !typing && !focus && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "?" && !typing && !focus && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcuts(true);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [focus]);

  useEffect(() => {
    void import("./sync/engine").then((m) => m.startSync());
  }, []);

  useEffect(() => {
    if (!word) window.scrollTo({ top: 0 });
  }, [route.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className={`app ${focus ? "is-focus" : ""} ${immersiveLounge ? "is-lounge-item" : ""} ${!focus && !immersiveLounge ? "has-sidebar" : ""}`}>
      {!focus && !immersiveLounge && <Sidebar page={route.page} dark={dark} onSearch={() => setPalette(true)} onShortcuts={() => setShortcuts(true)} />}
      {!focus && (
        <header className="topbar">
          <a className="topbar-logo" href="#/" aria-label="法语词光首页">
            <Logo />
          </a>
          <nav className="topnav" aria-label="主导航">
            {MAIN_NAV.map(({ page, label, href }) => (
              <a key={page} href={href} className={navOn(route.page, page) ? "is-on" : ""} aria-current={navOn(route.page, page) ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="topbar-tools">
            <button className="search-pill" onClick={() => setPalette(true)} aria-label="搜索单词" aria-keyshortcuts="Meta+K Control+K /">
              <Search size={17} />
              <span>搜索单词</span>
              <kbd>{shortcutLabel}</kbd>
            </button>
            <AmbiencePicker />
            <button className="icon-btn" onClick={() => store.settings({ theme: dark ? "light" : "dark" })} aria-label={dark ? "切换到浅色" : "切换到深色"}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <a className="icon-btn hide-sm" href="#/about" aria-label="关于与开源" title="关于与开源">
              <Github size={19} />
            </a>
          </div>
        </header>
      )}

      <main className="main" id="main">
        {saveError && (
          <div className="global-save-alert" role="alert">
            <span>本地存储空间不足或被浏览器拒绝，新学习进度可能无法保存。请尽快导出 JSON 备份以免丢失！</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void downloadBackupFile()}>
              立即导出备份
            </button>
          </div>
        )}
        <Suspense fallback={
          <div className="page skeleton-page" aria-busy="true" aria-label="页面加载中">
            <span className="skeleton-line is-sm" />
            <span className="skeleton-line is-lg" />
            <span className="skeleton-line is-md" />
          </div>
        }>
          {route.page === "today" && <Today />}
          {route.page === "atlas" && <AtlasPage route={route} />}
          {route.page === "dict" && <Dict word={route.w} query={route.q} tab={route.tab} />}
          {route.page === "learn" && <Learn />}
          {route.page === "practice" && <Practice key={route.src ?? "hub"} src={route.src} autostart={route.autostart} />}
          {route.page === "mock" && <MockExam onExit={() => go({ page: "practice" })} />}
          {route.page === "speak" && <SpeakingStudio onExit={() => go({ page: "practice" })} />}
          {route.page === "listen" && <ComprehensionStudio key="listen" kind="listen" onExit={() => go({ page: "practice" })} />}
          {route.page === "examread" && <ComprehensionStudio key="read" kind="read" onExit={() => go({ page: "practice" })} />}
          {route.page === "essay" && <EssayStudio onExit={() => go({ page: "practice" })} />}
          {route.page === "real" && <RealListening onExit={() => go({ page: "practice" })} />}
          {route.page === "drill" && <DrillStudio onExit={() => go({ page: "practice" })} />}
          {route.page === "expr" && <ExprStudio onExit={() => go({ page: "practice" })} />}
          {route.page === "reflow" && <MistakeReflow onExit={() => go({ page: "practice" })} />}
          {route.page === "read" && <Read textId={route.t} />}
          {route.page === "conj" && <Conj />}
          {route.page === "grammar" && <Grammar pointId={route.p} sheet={!!route.sheet} sprint={route.sprint} />}
          {route.page === "compare" && <Compare focusId={route.g} />}
          {route.page === "me" && <Me />}
          {route.page === "about" && <About />}
          {route.page === "decks" && <Decks deckId={route.d} />}
          {route.page === "lounge" && <Lounge route={route} />}
        </Suspense>
      </main>

      {!focus && !immersiveLounge && (
        <footer className="footer">
          <Logo compact />
          <p>
            DELF B2 全科备考与法语词典 · 免费开源 ·{" "}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>{" "}
            · <a href="#/about">关于</a>
          </p>
        </footer>
      )}

      {!focus && !immersiveLounge && (
        <nav className="tabbar" aria-label="底部主导航">
          {MAIN_NAV.map(({ page, label, href, icon: Icon }) => (
            <a key={page} href={href} className={navOn(route.page, page) ? "is-on" : ""} aria-current={navOn(route.page, page) ? "page" : undefined}>
              <Icon size={22} strokeWidth={navOn(route.page, page) ? 2.1 : 1.7} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      )}

      <WordSheet id={target} />
      <ConfirmSheetHost />
      {palette && <Suspense fallback={null}><Palette open={palette} onClose={() => setPalette(false)} /></Suspense>}
      {!onboarded && route.page !== "about" && !splash && <Suspense fallback={null}><Onboarding /></Suspense>}
      {splash && (
        <Suspense fallback={<div className="splash is-gather" aria-hidden="true" />}>
          <Splash onDone={() => setSplash(false)} />
        </Suspense>
      )}
      {shortcuts && (
        <Suspense fallback={null}>
          <ShortcutsSheet open={shortcuts} onClose={() => setShortcuts(false)} />
        </Suspense>
      )}
      <Toasts />
      {syncConflict && <Suspense fallback={null}><SyncConflictDialog /></Suspense>}
      <UpdateNote />
      <AmbienceController />
    </div>
  );
}

function WordSheet({ id }: { id: string | null }) {
  const atlas = useAtlas();
  const opened = id !== null;
  useEffect(() => {
    if (opened && store.get().settings.sfx) void cue("page");
  }, [opened]);
  const { entry, error } = useEntry(id);
  const ref = id ? atlas.byId.get(id) : undefined;
  const neighbor = useCallback(
    (d: number) => {
      if (!ref) return;
      const n = atlas.words[ref.order + d];
      if (n) go(currentLocation().route, n.id, true);
    },
    [atlas, ref],
  );
  useEffect(() => {
    if (!id) return;
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") neighbor(-1);
      if (e.key === "ArrowRight") neighbor(1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [id, neighbor]);
  return (
    <Sheet open={!!id} onClose={closeWord} label={ref ? `${ref.word} 词条` : "词条"} wide>
      {entry ? (
        <Suspense fallback={<div className="sheet-loading"><span className="spinner" /></div>}>
          <EntryView key={entry.id} entry={entry} />
        </Suspense>
      ) : error ? (
        <p className="sheet-error">{error}</p>
      ) : (
        <span className="spinner" />
      )}
      {ref && ref.order >= 0 && (
        <nav className="sheet-nav" aria-label="切换词条">
          <button className="icon-btn" onClick={() => neighbor(-1)} disabled={ref.order === 0} aria-label="上一个">
            <ChevronLeft size={20} />
          </button>
          <span>
            {(ref.order + 1).toLocaleString()} / {atlas.count.toLocaleString()}
          </span>
          <button className="icon-btn" onClick={() => neighbor(1)} disabled={ref.order >= atlas.count - 1} aria-label="下一个">
            <ChevronRight size={20} />
          </button>
        </nav>
      )}
    </Sheet>
  );
}

export { openWord };
