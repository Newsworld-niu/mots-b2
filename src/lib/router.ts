import { useSyncExternalStore } from "react";
import { transition } from "./motion";

export type Route =
  | { page: "today" }
  | { page: "atlas"; families?: string; pos?: string; d?: string; topic?: string; level?: string; q?: string; view?: string }
  | { page: "learn" }
  | { page: "practice" }
  | { page: "read"; t?: string }
  | { page: "conj" }
  | { page: "grammar"; p?: string; sheet?: string }
  | { page: "compare"; g?: string }
  | { page: "me" }
  | { page: "about" }
  | { page: "decks"; d?: string };

export interface Location {
  route: Route;
  /** Word sheet open on top of the route. */
  word: string | null;
}

function parse(hash: string): Location {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const word = params.get("w");
  const seg = path.split("/").filter(Boolean);
  let route: Route = { page: "today" };
  if (seg[0] === "atlas")
    route = { page: "atlas", families: params.get("families") || undefined, pos: params.get("pos") || undefined, d: params.get("d") || undefined, topic: params.get("topic") || undefined, level: params.get("level") || undefined, q: params.get("q") || undefined, view: params.get("view") || undefined };
  else if (seg[0] === "learn") route = { page: "learn" };
  else if (seg[0] === "practice") route = { page: "practice" };
  else if (seg[0] === "read") route = { page: "read", t: params.get("t") || undefined };
  else if (seg[0] === "conj") route = { page: "conj" };
  else if (seg[0] === "grammar") route = { page: "grammar", p: params.get("p") || undefined, sheet: params.get("sheet") || undefined };
  else if (seg[0] === "compare") route = { page: "compare", g: params.get("g") || undefined };
  else if (seg[0] === "me") route = { page: "me" };
  else if (seg[0] === "about") route = { page: "about" };
  else if (seg[0] === "decks") route = { page: "decks", d: params.get("d") || undefined };
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
  if (route.page === "compare" && route.g) params.set("g", route.g);
  if (route.page === "decks" && route.d) params.set("d", route.d);
  if (route.page === "grammar" && route.p) params.set("p", route.p);
  if (route.page === "grammar" && route.sheet) params.set("sheet", route.sheet);
  if (route.page === "read" && route.t) params.set("t", route.t);
  if (word) params.set("w", word);
  const q = params.toString();
  return `#/${route.page === "today" ? "" : route.page}${q ? `?${q}` : ""}`;
}

let loc = parse(location.hash);
const subs = new Set<() => void>();
/**
 * Show what the address says when the update runs, not when it was asked for: a page change waits for its
 * crossfade, and a navigation in the meantime (two taps, Back twice) must not be undone when it lands.
 */
const settleLocation = () => {
  loc = parse(location.hash);
  subs.forEach((f) => f());
};
window.addEventListener("hashchange", () => {
  const next = parse(location.hash);
  const pageChange = next.route.page !== loc.route.page;
  const update = settleLocation;
  // Crossfade between pages; the word sheet animates on its own.
  if (pageChange && !next.word) transition(update);
  else update();
});

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
  if (replace) history.replaceState(null, "", h);
  else history.pushState(null, "", h);
  const next = parse(h);
  const pageChange = next.route.page !== loc.route.page;
  const update = settleLocation;
  if (pageChange && !replace) transition(update);
  else update();
}

export const openWord = (id: string) => go(loc.route, id);
export const closeWord = () => go(loc.route, null);
export const currentLocation = () => loc;
