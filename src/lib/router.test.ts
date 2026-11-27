import assert from "node:assert/strict";
import { test } from "node:test";
import { href, parseHash, resolvePathnameToHash } from "./router";

test("dict route opens and closes WordSheet via ?card= without clobbering ?w= dictionary entry", () => {
  const openUrl = href({ page: "dict", w: "etre" }, "etre");
  assert.equal(openUrl, "#/dict?w=etre&card=etre");

  const opened = parseHash(openUrl);
  assert.deepEqual(opened, { route: { page: "dict", w: "etre", q: undefined }, word: "etre" });

  const closedUrl = href(opened.route, null);
  assert.equal(closedUrl, "#/dict?w=etre");

  const closed = parseHash(closedUrl);
  assert.deepEqual(closed, { route: { page: "dict", w: "etre", q: undefined }, word: null });
});

test("non-dict routes continue using ?w= for WordSheet", () => {
  const url = href({ page: "atlas", level: "B2" }, "nuancer");
  assert.equal(url, "#/atlas?level=B2&w=nuancer");
  assert.deepEqual(parseHash(url), {
    route: { page: "atlas", families: undefined, pos: undefined, d: undefined, topic: undefined, level: "B2", q: undefined, view: undefined },
    word: "nuancer",
  });
});

test("Phase3: formal studio routes round-trip cleanly via href and parseHash", () => {
  const studios = ["mock", "speak", "listen", "examread", "essay", "real", "drill", "expr", "reflow"] as const;
  for (const page of studios) {
    const url = href({ page });
    assert.equal(url, `#/${page}`);
    assert.deepEqual(parseHash(url), { route: { page }, word: null });
    const withWord = href({ page }, "etre");
    assert.equal(withWord, `#/${page}?w=etre`);
    assert.deepEqual(parseHash(withWord), { route: { page }, word: "etre" });
  }
});

test("lounge route round-trips shelf, item, ch, and WordSheet ?w= cleanly", () => {
  assert.equal(href({ page: "lounge" }), "#/lounge");
  assert.deepEqual(parseHash("#/lounge"), {
    route: { page: "lounge", shelf: undefined, item: undefined, ch: undefined },
    word: null,
  });

  const deepUrl = href({ page: "lounge", shelf: "books", item: "petit-prince", ch: "0" }, "apprivoiser");
  assert.equal(deepUrl, "#/lounge?shelf=books&item=petit-prince&ch=0&w=apprivoiser");
  assert.deepEqual(parseHash(deepUrl), {
    route: { page: "lounge", shelf: "books", item: "petit-prince", ch: "0" },
    word: "apprivoiser",
  });

  const invalidShelf = parseHash("#/lounge?shelf=unknown&item=v1");
  assert.deepEqual(invalidShelf, {
    route: { page: "lounge", shelf: undefined, item: "v1", ch: undefined },
    word: null,
  });
});

test("grammar route round-trips point, sheet, sprint and section deep links", () => {
  assert.equal(href({ page: "grammar" }), "#/grammar");
  assert.deepEqual(parseHash("#/grammar"), {
    route: { page: "grammar", p: undefined, sheet: undefined, sprint: undefined, section: undefined },
    word: null,
  });
  const pointUrl = href({ page: "grammar", p: "double-pronoms", section: "r1" });
  assert.equal(pointUrl, "#/grammar?p=double-pronoms&section=r1");
  assert.deepEqual(parseHash(pointUrl).route, { page: "grammar", p: "double-pronoms", sheet: undefined, sprint: undefined, section: "r1" });
  const sheetUrl = href({ page: "grammar", sheet: "1", section: "mat-relatifs" }, "dont");
  assert.equal(sheetUrl, "#/grammar?sheet=1&section=mat-relatifs&w=dont");
  assert.deepEqual(parseHash(sheetUrl), {
    route: { page: "grammar", p: undefined, sheet: "1", sprint: undefined, section: "mat-relatifs" },
    word: "dont",
  });
  assert.equal(parseHash("#/grammar?sprint=xyz&section=").route.page, "grammar");
  assert.deepEqual(parseHash("#/grammar?sprint=xyz&section=").route, { page: "grammar", p: undefined, sheet: undefined, sprint: undefined, section: undefined });
  assert.equal(href({ page: "grammar", sprint: "tef" }), "#/grammar?sprint=tef");
});

test("dict tab deep link round-trips, and the default 法汉释义 tab is never written", () => {
  const url = href({ page: "dict", w: "prendre", tab: "conj" });
  assert.equal(url, "#/dict?w=prendre&tab=conj");
  assert.deepEqual(parseHash(url), { route: { page: "dict", w: "prendre", q: undefined, tab: "conj" }, word: null });
  assert.equal(href({ page: "dict", w: "accueil", tab: "zh" }), "#/dict?w=accueil");
  assert.equal(href({ page: "dict", w: "accueil" }), "#/dict?w=accueil");
  assert.deepEqual(parseHash("#/dict?w=accueil&tab=zh"), { route: { page: "dict", w: "accueil", q: undefined }, word: null });
  // unknown tabs are dropped rather than trusted
  assert.deepEqual(parseHash("#/dict?w=accueil&tab=evil"), { route: { page: "dict", w: "accueil", q: undefined }, word: null });
  assert.equal(href({ page: "dict", w: "beau", tab: "relations" }, "beau"), "#/dict?w=beau&tab=relations&card=beau");
});

test("hash path segments open grammar points, dictionary entries and words, and never throw on bad escapes", () => {
  assert.deepEqual(parseHash("#/grammar/causatif").route, { page: "grammar", p: "causatif", sheet: undefined, sprint: undefined, section: undefined });
  assert.equal((parseHash("#/grammar/causatif?p=subjonctif").route as { p?: string }).p, "subjonctif");
  assert.equal((parseHash("#/grammar/causatif?sheet=s1&sprint=tef").route as { sheet?: string }).sheet, "s1");
  assert.equal((parseHash("#/grammar").route as { p?: string }).p, undefined);

  assert.deepEqual(parseHash("#/dict/prendre"), { route: { page: "dict", w: "prendre", q: undefined }, word: null });
  assert.equal((parseHash("#/dict/%C3%AAtre").route as { w?: string }).w, "être");
  assert.equal((parseHash("#/dict/prendre?w=mettre").route as { w?: string }).w, "mettre");
  assert.deepEqual(parseHash("#/dict/prendre?tab=conj&card=prendre"), {
    route: { page: "dict", w: "prendre", q: undefined, tab: "conj" },
    word: "prendre",
  });

  // Malformed % sequences fall back to the raw text instead of throwing URIError.
  assert.doesNotThrow(() => parseHash("#/dict/%E0%A4%A"));
  assert.equal((parseHash("#/dict/%E0%A4%A").route as { w?: string }).w, "%E0%A4%A");
  assert.equal((parseHash("#/grammar/100%").route as { p?: string }).p, "100%");
  assert.deepEqual(parseHash("#/w/%ZZ"), { route: { page: "atlas" }, word: "%ZZ" });
  assert.deepEqual(parseHash("#/w/%C3%A9t%C3%A9"), { route: { page: "atlas" }, word: "été" });
});

test("resolvePathnameToHash turns history-style deep links into canonical hash routes", () => {
  assert.equal(resolvePathnameToHash("/grammar/causatif"), "#/grammar?p=causatif");
  assert.equal(resolvePathnameToHash("/grammar/causatif", "?sheet=s2&section=forms"), "#/grammar?p=causatif&sheet=s2&section=forms");
  assert.equal(resolvePathnameToHash("/grammar"), "#/grammar");
  assert.equal(resolvePathnameToHash("/grammar/"), "#/grammar");
  assert.equal(resolvePathnameToHash("/dict/prendre"), "#/dict?w=prendre");
  assert.equal(resolvePathnameToHash("/dict/%C3%AAtre", "?tab=conj"), `#/dict?w=${encodeURIComponent("être")}&tab=conj`);
  assert.equal(resolvePathnameToHash("/dict", "?q=pren"), "#/dict?q=pren");
  assert.equal(resolvePathnameToHash("/atlas", "?level=B2&w=nuancer"), "#/atlas?level=B2&w=nuancer");
  assert.equal(resolvePathnameToHash("/w/nuancer"), "#/atlas?w=nuancer");
  assert.equal(resolvePathnameToHash("/me"), "#/me");
  assert.equal(resolvePathnameToHash("/lounge", "?shelf=books&item=b1"), "#/lounge?shelf=books&item=b1");
  for (const page of ["learn", "practice", "mock", "speak", "listen", "examread", "essay", "real", "drill", "expr", "reflow", "read", "conj", "compare", "about", "decks"]) {
    assert.equal(resolvePathnameToHash(`/${page}`), `#/${page}`, page);
  }

  // Not deep links: the root, static files, unknown pages, extra segments.
  assert.equal(resolvePathnameToHash("/"), null);
  assert.equal(resolvePathnameToHash(""), null);
  assert.equal(resolvePathnameToHash("/index.html"), null);
  assert.equal(resolvePathnameToHash("/atlas/index.json"), null);
  assert.equal(resolvePathnameToHash("/atlas/audio/f/rue.mp3"), null);
  assert.equal(resolvePathnameToHash("/dict/prendre.json"), null);
  assert.equal(resolvePathnameToHash("/assets/index-abc.js"), null);
  assert.equal(resolvePathnameToHash("/sw.js"), null);
  assert.equal(resolvePathnameToHash("/manifest.webmanifest"), null);
  assert.equal(resolvePathnameToHash("/unknown"), null);
  assert.equal(resolvePathnameToHash("/me/extra"), null);
  assert.equal(resolvePathnameToHash("/grammar/a/b"), null);
  assert.equal(resolvePathnameToHash("/w"), null);
  assert.equal(resolvePathnameToHash("/w/"), null);

  // Sub-path deployments strip the Vite base first.
  assert.equal(resolvePathnameToHash("/mots-b2/grammar/causatif", "", "/mots-b2/"), "#/grammar?p=causatif");
  assert.equal(resolvePathnameToHash("/mots-b2/", "", "/mots-b2/"), null);
  assert.equal(resolvePathnameToHash("/mots-b2", "", "/mots-b2/"), null);
  assert.equal(resolvePathnameToHash("/grammar/causatif", "", "/mots-b2/"), null);

  // Malformed escapes never throw.
  assert.doesNotThrow(() => resolvePathnameToHash("/dict/%E0%A4%A"));
});
