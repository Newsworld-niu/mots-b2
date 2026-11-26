import assert from "node:assert/strict";
import { test } from "node:test";

test("on load, a pathname deep link is rewritten to its hash route before the first render", async () => {
  const replaced: string[] = [];
  const location = { pathname: "/grammar/causatif", search: "?sheet=s2", hash: "", protocol: "https:", origin: "https://app.test" };
  const win = {
    location,
    history: {
      replaceState: (_s: unknown, _t: string, url: string) => {
        replaced.push(url);
        const u = new URL(url, "https://app.test");
        location.pathname = u.pathname;
        location.search = u.search;
        location.hash = u.hash;
      },
      pushState: () => undefined,
    },
    addEventListener: () => undefined,
  };
  (globalThis as { window?: unknown }).window = win;
  try {
    const router = await import("./router");
    assert.deepEqual(replaced, ["/#/grammar?p=causatif&sheet=s2"]);
    assert.deepEqual(router.currentLocation(), {
      route: { page: "grammar", p: "causatif", sheet: "s2", sprint: undefined, section: undefined },
      word: null,
    });
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});
