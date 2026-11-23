import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeeklyRemediation, renderMockDiagnosticHtml } from "./remediation";

test("buildWeeklyRemediation prioritizes eliminatory/weakest skill and generates 7 daily tasks", () => {
  const now = 1_750_000_000_000;
  const plan = buildWeeklyRemediation({
    log: [
      { part: "listen", what: "mock-1", score: 4, total: 25, level: "B2", scope: "full", at: now - 1000 },
      { part: "read", what: "mock-2", score: 17, total: 25, level: "B2", scope: "full", at: now - 900 },
      { part: "essay", what: "courrier-voitures", score: 15, total: 25, level: "B2", scope: "full", at: now - 800 },
      { part: "speak", what: "mock-s1", score: 14, total: 25, level: "B2", scope: "full", at: now - 700 },
    ],
    compMisses: [{ at: now - 500, part: "listen", cause: "negation" }],
    gramTags: { subjonctif: { n: 4, w: 3 } },
    target: 75,
    now,
  });

  assert.equal(plan.focusPart, "listen");
  assert.equal(plan.total100, 50);
  assert.equal(plan.tasks.length, 7);
  assert.ok(plan.tasks[0].title.includes("听力"));
  assert.ok(plan.tasks[1].title.includes("否定"));
  assert.equal(plan.tasks[6].route, "#/mock");
});

test("renderMockDiagnosticHtml escapes user strings and highlights eliminatory scores", () => {
  const html = renderMockDiagnosticHtml({
    record: {
      at: 1_750_000_000_000,
      label: "套卷 1 <script>alert(1)</script>",
      strict: true,
      co: 4.5,
      ce: 18,
      pe: 16,
      po: 17,
      total100: 55.5,
      typedPo: false,
    },
    target: 75,
    topCauses: [{ cause: "paraphrase", n: 3, share: 60 }],
    weakGrammarTitles: ["虚拟式 <b>subjonctif</b>"],
  });

  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("淘汰线以下"));
  assert.ok(html.includes("55.5"));
  assert.ok(html.includes("&lt;b&gt;subjonctif&lt;/b&gt;"));
});