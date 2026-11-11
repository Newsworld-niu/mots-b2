import assert from "node:assert/strict";
import { test } from "node:test";

import { customEntry, editedEntry } from "./merge.ts";
import { sanitizeUserData } from "../store/store.ts";
import type { Entry } from "./types.ts";

test("own collocations and 注意点 show on the card, before the atlas ones", () => {
  const c = customEntry("u-abcd1", { w: "rendez-vous", pos: "n.m.", zh: "约会", note: "复数不变：des rendez-vous", col: ["prendre rendez-vous｜预约"], created: 0 });
  assert.deepEqual(c.col, ["prendre rendez-vous｜预约"]);
  assert.equal(c.tip, "复数不变：des rendez-vous");
  const base = { id: "x", w: "avocat", col: ["avocat général｜检察官"], tip: "atlas tip", senses: [], ex: [] } as unknown as Entry;
  const e = editedEntry(base, { col: ["un avocat bien mûr｜熟透的牛油果", "avocat général｜检察官"], tip: "我的提示" });
  assert.deepEqual(e.col, ["un avocat bien mûr｜熟透的牛油果", "avocat général｜检察官"], "no repeat");
  assert.equal(e.tip, "我的提示\n\natlas tip");
});

test("collocations and tips survive a backup, and bad ones are dropped", () => {
  const out = sanitizeUserData({
    custom: { "u-abcd1": { w: "chat", zh: "猫", pos: "n.m.", col: ["chat noir｜黑猫", "chat noir｜黑猫", "｜x", 5] } },
    edits: { avocat: { col: ["avocat général｜检察官"], tip: "注意" } },
  });
  assert.deepEqual(out.custom?.["u-abcd1"].col, ["chat noir｜黑猫"]);
  assert.deepEqual(out.edits?.avocat, { col: ["avocat général｜检察官"], tip: "注意" });
});
