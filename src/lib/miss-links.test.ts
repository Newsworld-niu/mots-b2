import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { GrammarData } from "./grammar.ts";
import { MISS_CAUSES } from "./listening.ts";
import { missLinksFor } from "./miss-links.ts";

const grammar = JSON.parse(fs.readFileSync("public/atlas/grammar.json", "utf8")) as GrammarData;
const pointIds = new Set(grammar.points.map((p) => p.id));

test("SYS-7: every listening/reading miss cause maps to valid grammar points or intensive training actions", () => {
  for (const cause of MISS_CAUSES) {
    for (const kind of ["listen", "read"] as const) {
      const links = missLinksFor(cause, kind);
      assert.ok(links.length >= 2, `${kind}:${cause} should offer at least 2 follow-up links`);
      for (const link of links) {
        assert.ok(link.label.trim().length > 0);
        assert.ok(link.route || link.action, `${kind}:${cause} link must specify a route or action`);
        if (link.route?.page === "grammar" && link.route.p) {
          assert.ok(pointIds.has(link.route.p), `grammar point '${link.route.p}' must exist in grammar.json`);
        }
      }
    }
  }

  // Listening "heard" links directly into intensive real listening; reading "heard" links into reading
  const listenHeard = missLinksFor("heard", "listen");
  assert.ok(listenHeard.some((l) => l.action === "real"));
  const readHeard = missLinksFor("heard", "read");
  assert.ok(readHeard.some((l) => l.route?.page === "read"));

  // Negation trap points directly to restriction / negation-nuances grammar rules
  const negLinks = missLinksFor("negation", "listen");
  assert.ok(negLinks.some((l) => l.route?.page === "grammar" && l.route.p === "restriction"));
  assert.ok(negLinks.some((l) => l.route?.page === "grammar" && l.route.p === "negation-nuances"));
});
