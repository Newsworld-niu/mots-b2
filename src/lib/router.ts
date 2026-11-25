import { useSyncExternalStore } from "react";
import { transition } from "./motion";
import { activeNavGuard } from "./nav-guard";
import { confirmAction } from "../ui/ConfirmSheet";

/** Tabs of a dictionary entry (#/dict?w=…&tab=…); "zh" is the default and is never written to the URL. */
export type DictTab = "zh" | "conj" | "phrases" | "examples" | "relations" | "fr" | "etym" | "notes";
export const DICT_TABS: readonly DictTab[] = ["zh", "conj", "phrases", "examples", "relations", "fr", "etym", "notes"];
const isDictTab = (v: string | null): v is DictTab => !!v && (DICT_TABS as readonly string[]).includes(v);

export type Route =
  | { page: "today" }
  | { page: "atlas"; families?: string; pos?: string; d?: string; topic?: string; level?: string; q?: string; view?: string }
  | { page: "dict"; w?: string; q?: string; tab?: DictTab }
  | { page: "learn" }
  | { page: "practice" }
  | { page: "mock" }
  | { page: "speak" }
  | { page: "listen" }
  | { page: "examread" }
  | { page: "essay" }
  | { page: "real" }
  | { page: "drill" }
  | { page: "expr" }
  | { page: "reflow" }
  | { page: "read"; t?: string }
  | { page: "conj" }
  | { page: "grammar"; p?: string; sheet?: string; sprint?: "tcf" | "tef" }
  | { page: "compare"; g?: string }
  | { page: "me" }
  | { page: "about" }
  | { page: "decks"; d?: string }
  | { page: "lounge"; shelf?: "books" | "reads" | "videos"; item?: string; ch?: string };

const STUDIO_PAGES = new Set<Route["page"]>([
  "mock",
  "speak",
  "listen",
  "examread",
  "essay",
  "real",
  "drill",
  "expr",
  "reflow",
]);

export interface Location {
  route: Route;
  /** Word sheet open on top of the route. */
  word: string | null;
}

export function parseHash(hash: string): Location {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const word = params.get("w");
  const seg = path.split("/").filter(Boolean);
  let route: Route = { page: "today" };
  if (seg[0] === "dict") {
    const tab = params.get("tab");
    return {
      route: {
        page: "dict",
        w: params.get("w") || undefined,
        q: params.get("q") || undefined,
        ...(isDictTab(tab) && tab !== "zh" ? { tab } : {}),
      },
      word: params.get("card") || null,
    };
  }
  if (seg[0] === "atlas")
    route = { page: "atlas", families: params.get("families") || undefined, pos: params.get("pos") || undefined, d: params.get("d") || undefined, topic: params.get("topic") || undefined, level: params.get("level") || undefined, q: params.get("q") || undefined, view: params.get("view") || undefined };
  else if (seg[0] === "learn") route = { page: "learn" };
  else if (seg[0] === "practice") route = { page: "practice" };
  else if (STUDIO_PAGES.has(seg[0] as Route["page"])) route = { page: seg[0] as Route["page"] } as Route;
  else if (seg[0] === "read") route = { page: "read", t: params.get("t") || undefined };
  else if (seg[0] === "conj") route = { page: "conj" };
  else if (seg[0] === "grammar") {
    const rawSprint = params.get("sprint");
    const sprint = rawSprint === "tcf" || rawSprint === "tef" ? rawSprint : undefined;
    route = { page: "grammar", p: params.get("p") || undefined, sheet: params.get("sheet") || undefined, sprint };
  }
  else if (seg[0] === "compare") route = { page: "compare", g: params.get("g") || undefined };
  else if (seg[0] === "me") route = { page: "me" };
  else if (seg[0] === "about") route = { page: "about" };
  else if (seg[0] === "decks") route = { page: "decks", d: params.get("d") || undefined };
  else if (seg[0] === "lounge") {
    const rawShelf = params.get("shelf");
    const shelf = rawShelf === "books" || rawShelf === "reads" || rawShelf === "videos" ? rawShelf : undefined;
    route = {
      page: "lounge",
      shelf,
      item: params.get("item") || undefined,
      ch: params.get("ch") || undefined,
    };
  }
  else if (seg[0] === "w" && seg[1]) return { route: { page: "atlas" }, word: decodeURIComponent(seg[1]) };
  return { route, word };
}

export function href(route: Route, word?: string | null) {
  const params = new URLSearchParams();
  if (route.page === "atlas") {
    if (route.families) params.set("families", route.families);
    if (route.pos) params.set("pos", route.pos);
    if (route.d) params.set("d", route.d);
    if (route.topic) params.set("topic", route.topic);
    if (route.level) params.set("level", route.level);
    if (route.q) params.set("q", route.q);
    if (route.view) params.set("view", route.view);
  }
  if (route.page === "dict") {
    if (route.w) params.set("w", route.w);
    if (route.q) params.set("q", route.q);
    if (route.tab && route.tab !== "zh" && isDictTab(route.tab)) params.set("tab", route.tab);
    if (word) params.set("card", word);
  }
  if (route.page === "compare" && route.g) params.set("g", route.g);
  if (route.page === "decks" && route.d) params.set("d", route.d);
  if (route.page === "grammar" && route.p) params.set("p", route.p);
  if (route.page === "grammar" && route.sheet) params.set("sheet", route.sheet);
  if (route.page === "grammar" && route.sprint) params.set("sprint", route.sprint);
  if (route.page === "read" && route.t) params.set("t", route.t);
  if (route.page === "lounge") {
    if (route.shelf) params.set("shelf", route.shelf);
    if (route.item) params.set("item", route.item);
    if (route.ch) params.set("ch", route.ch);
  }
  if (word && route.page !== "dict") params.set("w", word);
  const q = params.toString();
  return `#/${route.page === "today" ? "" : route.page}${q ? `?${q}` : ""}`;
}

let loc: Location = typeof window !== "undefined" ? parseHash(window.location.hash) : { route: { page: "today" }, word: null };
const subs = new Set<() => void>();
let lastConfirmedHash: string | null = null;
let promptingGuard = false;
/**
 * Show what the address says when the update runs, not when it was asked for: a page change waits for its
 * crossfade, and a navigation in the meantime (two taps, Back twice) must not be undone when it lands.
 */
const settleLocation = () => {
  if (typeof window === "undefined") return;
  loc = parseHash(window.location.hash);
  subs.forEach((f) => f());
};
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const targetHash = window.location.hash;
    const next = parseHash(targetHash);
    const pageChange = next.route.page !== loc.route.page;
    const guardMsg = pageChange ? activeNavGuard() : null;
    if (guardMsg && targetHash !== lastConfirmedHash) {
      const prevHash = href(loc.route, loc.word);
      window.history.pushState(null, "", prevHash);
      if (!promptingGuard) {
        promptingGuard = true;
        void confirmAction({
          title: "确认离开当前练习？",
          message: guardMsg,
          confirmLabel: "仍要离开",
          cancelLabel: "留在这里",
          danger: true,
        }).then((ok) => {
          promptingGuard = false;
          if (!ok) return;
          lastConfirmedHash = targetHash;
          window.history.replaceState(null, "", targetHash);
          const update = settleLocation;
          if (!next.word) transition(update);
          else update();
          lastConfirmedHash = null;
        });
      }
      return;
    }
    const update = settleLocation;
    // Crossfade between pages; the word sheet animates on its own.
    if (pageChange && !next.word) transition(update);
    else update();
  });
}

export const useLocation = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => loc,
  );

export function go(route: Route, word?: string | null, replace = false) {
  const h = href(route, word);
  const next = parseHash(h);
  const pageChange = next.route.page !== loc.route.page;
  const finalize = () => {
    if (typeof window !== "undefined") {
      if (replace) window.history.replaceState(null, "", h);
      else window.history.pushState(null, "", h);
    }
    const update = settleLocation;
    if (typeof window !== "undefined" && pageChange && !replace) transition(update);
    else update();
  };
  if (typeof window !== "undefined" && pageChange) {
    const guardMsg = activeNavGuard();
    if (guardMsg && h !== lastConfirmedHash) {
      if (promptingGuard) return;
      promptingGuard = true;
      void confirmAction({
        title: "确认离开当前练习？",
        message: guardMsg,
        confirmLabel: "仍要离开",
        cancelLabel: "留在这里",
        danger: true,
      }).then((ok) => {
        promptingGuard = false;
        if (!ok) return;
        lastConfirmedHash = h;
        finalize();
        lastConfirmedHash = null;
      });
      return;
    }
  }
  finalize();
}

export const openWord = (id: string) => go(loc.route, id);
export const closeWord = () => go(loc.route, null);
export const currentLocation = () => loc;
