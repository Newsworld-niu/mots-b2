import { test } from "node:test";
import assert from "node:assert/strict";
import { wiktionaryLinks } from "./wiktionary.ts";

test("dictionary links preserve French accents and phrases and isolate URL punctuation", () => {
  assert.equal(wiktionaryLinks("  "), null);
  assert.equal(wiktionaryLinks("imposer")?.entry, "https://fr.wiktionary.org/wiki/imposer#Français");
  const links = wiktionaryLinks("  être   lié à  ")!;
  assert.equal(decodeURIComponent(new URL(links.entry).pathname), "/wiki/être_lié_à");
  assert.equal(new URL(links.search).searchParams.get("search"), "être lié à");
  const special = wiktionaryLinks("l'eau #?&")!;
  assert.equal(new URL(special.entry).search, "");
  assert.equal(decodeURIComponent(new URL(special.entry).hash), "#Français");
  assert.equal(new URL(special.search).searchParams.get("search"), "l'eau #?&");
});
