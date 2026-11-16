import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWiki, loadWiki } from "./wiki-import.ts";
import { cleanWikiSources } from "./wiktionary.ts";
import { sanitizeUserData } from "../store/store.ts";

test("imports French definitions, attributed examples and explicit families only", () => {
  const result = parseWiki(
    `== {{langue|en}} ==
=== {{S|nom|en}} ===
# English meaning
== {{langue|fr}} ==
=== {{S|verbe|fr}} ===
# [[Exiger]] quelque chose.
#* Il '''impose''' une taxe. {{source|Auteur, Livre}}
#*: continuation excluded
==== {{S|synonymes}} ====
* {{lien|exiger|fr}}
==== {{S|dérivés}} ====
* {{lien|imposition|fr}}
* {{lien|imposition|fr}}
==== {{S|apparentés}} ====
* [[poser]]
== {{langue|it}} ==
=== {{S|nom|it}} ===
# Italian meaning`,
    "imposer",
    123,
  );
  assert.deepEqual(
    result.items.map((x) => [x.kind, x.fr]),
    [
      ["sense", "Exiger quelque chose."],
      ["example", "Il impose une taxe. (Auteur, Livre)"],
      ["family", "imposition"],
      ["family", "poser"],
    ],
  );
  assert.equal(result.items[0].pos, "v.");
  assert.equal(new URL(result.source).searchParams.get("oldid"), "123");
});

test("fixed revision attribution survives card backup and rejects unrelated URLs", () => {
  const source = parseWiki("", "être lié à", 123).source;
  assert.deepEqual(
    cleanWikiSources([
      source,
      source,
      "javascript:alert(1)",
      "https://example.org/w/index.php?title=x&oldid=1",
    ]),
    [source],
  );
  const out = sanitizeUserData({
    custom: {
      "u-abcd1": { w: "lier", zh: "连接", pos: "v.", wikiSources: [source] },
    },
    edits: { lier: { wikiSources: [source] } },
  });
  assert.deepEqual(out.custom?.["u-abcd1"].wikiSources, [source]);
  assert.deepEqual(out.edits?.lier.wikiSources, [source]);
});

test("API request follows redirects and reports absent French content", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const u = new URL(String(input));
      assert.equal(u.searchParams.get("origin"), "*");
      assert.equal(u.searchParams.get("redirects"), "1");
      return new Response(
        JSON.stringify({
          parse: {
            title: "lier",
            revid: 123,
            wikitext:
              "== {{langue|fr}} ==\n=== {{S|verbe|fr}} ===\n# Attacher.",
          },
        }),
      );
    };
    assert.equal(
      (await loadWiki("lier", new AbortController().signal)).items[0].fr,
      "Attacher.",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ parse: { title: "x", revid: 123, wikitext: "" } }),
      );
    await assert.rejects(loadWiki("x", new AbortController().signal), /未识别/);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "missingtitle" } }));
    await assert.rejects(loadWiki("x", new AbortController().signal), /未找到/);
  } finally {
    globalThis.fetch = old;
  }
});

test("saving and later editing cards retains imported attribution", async () => {
  (globalThis as any).window ??= {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
  };
  const { createCustomWord, updateCustomWord, setWordEdit } =
    await import("../store/decks.ts");
  const { store } = await import("../store/store.ts");
  const source = parseWiki("", "lier", 123).source;
  const id = createCustomWord({
    w: "lier",
    zh: "连接",
    pos: "v.",
    wikiSources: [source],
  });
  updateCustomWord(id, { w: "lier", zh: "连接；捆绑", pos: "v." });
  assert.deepEqual(store.get().progress.custom?.[id].wikiSources, [source]);
  setWordEdit("lier", { wikiSources: [source] });
  setWordEdit("lier", { zh: "连接" });
  assert.deepEqual(store.get().progress.edits?.lier.wikiSources, [source]);
});
