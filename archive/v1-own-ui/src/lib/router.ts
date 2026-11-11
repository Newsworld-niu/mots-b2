import { useSyncExternalStore } from "react";

export type Page = "today" | "atlas" | "learn" | "practice" | "me";
const PAGES: Page[] = ["today", "atlas", "learn", "practice", "me"];

/**
 * Hash routing: #/atlas?topic=sante&word=symptome
 * Params are plain strings; `word` opens the entry sheet on top of any page.
 */
export function parseHash(hash: string): { page: Page; params: URLSearchParams } {
  const body = hash.replace(/^#\/?/, "");
  const [path, qs = ""] = body.split("?");
  const page = (PAGES.includes(path as Page) ? path : "today") as Page;
  return { page, params: new URLSearchParams(qs) };
}

function build(page: Page, params: URLSearchParams) {
  const qs = params.toString();
  return `#/${page === "today" ? "" : page}${qs ? `?${qs}` : ""}`;
}

export function go(page: Page, patch: Record<string, string | null | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(patch)) if (v) params.set(k, v);
  const next = build(page, params);
  if (location.hash !== next) location.hash = next;
}

/** Update params on the current page, keeping the page itself. */
export function setParams(patch: Record<string, string | null | undefined>) {
  const { page, params } = parseHash(location.hash);
  for (const [k, v] of Object.entries(patch)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  const next = build(page, params);
  if (location.hash !== next) location.hash = next;
}

export function openWord(id: string) {
  setParams({ word: id });
}

export function closeWord() {
  setParams({ word: null });
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const snapshot = () => location.hash;

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, snapshot, () => "");
  return parseHash(hash);
}
