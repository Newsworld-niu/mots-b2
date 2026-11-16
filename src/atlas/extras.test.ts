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

test("anything from AI 讲解 can be put on a card and taken off again; the edit form keeps it", async () => {
  // the store saves a moment after each change: no saving in this test
  (globalThis as any).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const { addToCard, removeFromCard, ownParts, setWordEdit, createCustomWord, updateCustomWord } = await import("../store/decks.ts");
  const { store, sanitizeUserData } = await import("../store/store.ts");
  const own = (id: string) => ownParts(store.get().progress, id);
  const base = { id: "inferieur", w: "inférieur", uk: "", us: "", senses: [{ pos: "adj.", zh: "较低的；下级的", en: "" }], ex: [{ en: "Un étage inférieur.", zh: "下面一层。" }], col: [], fam: [], syn: ["bas"], ant: [], tip: "词库的提示", cefr: "B1", topic: "", m: 0 };

  for (const id of ["inferieur", createCustomWord({ w: "de manière effective", pos: "loc.", zh: "有效地" })]) {
    assert.equal(addToCard(id, { sense: { pos: "adj.", zh: "下方的；下部的" } }), true);
    assert.equal(addToCard(id, { sense: { pos: "adj.", zh: "下方的；下部的" } }), false, "not twice");
    assert.equal(addToCard(id, { ex: { fr: "La température sera inférieure à zéro.", zh: "气温将低于零度。" } }), true);
    assert.equal(addToCard(id, { syn: "moindre (较小的)" }), true);
    assert.equal(addToCard(id, { ant: "supérieur (较高的)" }), true);
    assert.equal(addToCard(id, { fam: "infériorité (劣势)" }), true);
    assert.equal(addToCard(id, { col: "inférieur à｜低于" }), true);
    assert.equal(addToCard(id, { tip: "比较用 à，不用 que" }), true);
    assert.equal(addToCard(id, { tip: "第二条" }), true);
    assert.deepEqual(own(id).syn, ["moindre (较小的)"]);
    assert.equal(own(id).tip, "比较用 à，不用 que\n第二条");
  }

  // an atlas word shows them after its own text; the learner's 注意点 comes first
  const e = editedEntry(base, store.get().progress.edits!.inferieur);
  assert.deepEqual(e.senses.map((s) => s.zh), ["较低的；下级的", "下方的；下部的"]);
  assert.deepEqual(e.syn, ["bas", "moindre (较小的)"]);
  assert.deepEqual(e.ant, ["supérieur (较高的)"]);
  assert.deepEqual(e.fam, ["infériorité (劣势)"]);
  assert.equal(e.ex[0].en, "La température sera inférieure à zéro.");
  assert.ok(e.tip.startsWith("比较用 à，不用 que\n第二条"));

  // saving the edit form (which shows only gloss, examples, collocations and 注意点) keeps the rest
  setWordEdit("inferieur", { zh: "低的", ex: own("inferieur").ex, col: own("inferieur").col, tip: own("inferieur").tip });
  assert.deepEqual(own("inferieur").senses, [{ pos: "adj.", zh: "下方的；下部的" }]);
  const cid = Object.keys(store.get().progress.custom!)[0];
  updateCustomWord(cid, { w: "de manière effective", pos: "loc.", zh: "切实地", ex: own(cid).ex, col: own(cid).col, note: own(cid).tip });
  assert.deepEqual(own(cid).fam, ["infériorité (劣势)"]);
  assert.deepEqual(customEntry(cid, store.get().progress.custom![cid]).senses.map((s) => s.zh), ["切实地", "下方的；下部的"]);

  // and a backup keeps them
  const back = sanitizeUserData(JSON.parse(JSON.stringify(store.get().progress)));
  assert.deepEqual(back.edits!.inferieur.ant, ["supérieur (较高的)"]);
  assert.deepEqual(back.custom![cid].senses, [{ pos: "adj.", zh: "下方的；下部的" }]);

  // each can be taken off, by the French alone
  for (const id of ["inferieur", cid]) {
    removeFromCard(id, { sense: "下方的；下部的" });
    removeFromCard(id, { ex: "La température sera inférieure à zéro." });
    removeFromCard(id, { syn: "moindre" });
    removeFromCard(id, { ant: "supérieur (较高的)" });
    removeFromCard(id, { fam: "infériorité" });
    removeFromCard(id, { col: "inférieur à" });
    removeFromCard(id, { tip: "比较用 à，不用 que" });
    const o = own(id);
    assert.deepEqual([o.senses, o.ex, o.syn, o.ant, o.fam, o.col, o.tip], [undefined, undefined, undefined, undefined, [], undefined, "第二条"]);
  }
  removeFromCard("inferieur", { tip: "第二条" });
  assert.deepEqual(store.get().progress.edits?.inferieur, { zh: "低的", fam: [] });
});

test("one of the atlas's own meanings can be taken off a card and brought back; the last meaning stays", async () => {
  (globalThis as any).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const { addToCard, hideSense, restoreSenses, dropMainSense, createCustomWord } = await import("../store/decks.ts");
  const { store, sanitizeUserData } = await import("../store/store.ts");
  const { editedRef } = await import("./merge.ts");
  const base = { id: "aller", w: "aller", uk: "", us: "", senses: [{ pos: "v.", zh: "去", en: "" }, { pos: "v.", zh: "过得", en: "" }], ex: [], col: [], fam: [], syn: [], ant: [], tip: "", cefr: "A1", topic: "", m: 0 };
  const ref = { id: "aller", word: "aller", zh: "去", ipa: "", cefr: 0, topic: 0, media: 0, order: 0, more: ["过得"] };
  const edit = () => store.get().progress.edits!.aller;
  const zh = () => editedEntry(base, edit()).senses.map((s) => s.zh);

  addToCard("aller", { sense: { pos: "v.", zh: "前往" } });
  hideSense("aller", 0);
  assert.deepEqual(zh(), ["过得", "前往"]);
  // the word list and the questions show the same first meaning as the card
  assert.deepEqual([editedRef(ref, edit()).zh, editedRef(ref, edit()).more], ["过得", ["前往"]]);
  // the atlas position stays known after the first one is gone
  hideSense("aller", editedEntry(base, edit()).senses[0].n!);
  assert.deepEqual(zh(), ["前往"]);
  assert.deepEqual(sanitizeUserData(JSON.parse(JSON.stringify(store.get().progress))).edits!.aller.hide, [0, 1]);
  restoreSenses("aller");
  assert.deepEqual(zh(), ["去", "过得", "前往"]);
  // everything taken off: the atlas's own meanings stay rather than an empty card
  assert.deepEqual(editedEntry(base, { hide: [0, 1] }).senses.map((s) => s.zh), ["去", "过得"]);
  assert.equal(editedRef(ref, { hide: [0, 1] }).zh, "去");

  // an own word: the next meaning takes the place of the first
  const id = createCustomWord({ w: "turbulence", pos: "n.f.", zh: "气流颠簸", senses: [{ pos: "n.f.", zh: "动荡" }] });
  dropMainSense(id);
  const c = store.get().progress.custom![id];
  assert.deepEqual([c.zh, c.senses], ["动荡", undefined]);
  dropMainSense(id);
  assert.equal(store.get().progress.custom![id].zh, "动荡", "the only meaning is kept");
});

test("bundled content can be deleted completely and stays deleted after saving and backup", async () => {
  (globalThis as any).window ??= { setTimeout: () => 0, clearTimeout: () => undefined };
  const { store, sanitizeUserData, emptyProgress } = await import("../store/store.ts");
  const { removeFromCard, setWordEdit, addToCard } = await import("../store/decks.ts");
  store.progress(()=>emptyProgress("t"));
  const base = { id:"etre",w:"être",m:0,senses:[{pos:"v.",zh:"是",en:""}],ex:[],col:["être en retard｜迟到"],syn:["exister"],ant:["disparaître"],fam:["étant"],tip:"原有提示" } as unknown as Entry;
  let shown=base;
  for (const key of ["col","syn","ant","fam","tip"] as const) {
    const value=key==="tip" ? shown.tip : shown[key][0];
    removeFromCard("etre",{[key]:value},shown);
    shown=editedEntry(base,store.get().progress.edits!.etre);
  }
  assert.deepEqual([shown.col,shown.syn,shown.ant,shown.fam,shown.tip],[[],[],[],[],""]);
  const backup=sanitizeUserData(JSON.parse(JSON.stringify(store.get().progress)));
  setWordEdit("etre",{...backup.edits!.etre,zh:"存在"});
  shown=editedEntry(base,store.get().progress.edits!.etre);
  assert.deepEqual([shown.col,shown.syn,shown.ant,shown.fam,shown.tip],[[],[],[],[],""]);
  addToCard("etre",{col:"être prêt｜准备好了"});
  shown=editedEntry(base,store.get().progress.edits!.etre);
  assert.deepEqual(shown.col,["être prêt｜准备好了"]);
  assert.equal(shown.senses[0].zh,"存在");
});
