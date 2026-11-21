import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeDrillFeedback } from "./speaking-drill.ts";

test("sanitizeDrillFeedback clamps counts and drops empty or unchanged fixes", () => {
  const r = sanitizeDrillFeedback({ opinion: true, reasons: 9, comment: " ok ", fixes: [{ wrong: "je suis d'accord avec", right: "je suis d'accord avec", why: "" }, { wrong: "il faut que tu vas", right: "il faut que tu ailles", why: "subjonctif" }, "x"], better: "Bien." });
  assert.equal(r.opinion, true);
  assert.equal(r.reasons, 5);
  assert.equal(r.comment, "ok");
  assert.deepEqual(r.fixes, [{ wrong: "il faut que tu vas", right: "il faut que tu ailles", why: "subjonctif" }]);
  assert.deepEqual(sanitizeDrillFeedback(null), { opinion: false, reasons: 0, comment: "", fixes: [], better: "" });
});
