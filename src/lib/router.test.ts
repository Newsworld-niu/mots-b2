import assert from "node:assert/strict";
import { test } from "node:test";
import { href, parseHash } from "./router";

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
