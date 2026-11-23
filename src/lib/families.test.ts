import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILIES, familyWords, searchFamilies, setBaseFamiliesForTest } from "./families.ts";
import { todayPlan } from "../store/session.ts";
import { defaultSettings, emptyProgress, sanitizeSettings } from "../store/store.ts";
import type { Atlas, WordRef } from "../atlas/types.ts";
import { review, Rating } from "../store/srs.ts";

setBaseFamiliesForTest(JSON.parse(readFileSync(resolve("public/atlas/families.json"), "utf8")));

test("family search finds a group through a member; selection forms a deduplicated union", () => {
  const a = FAMILIES[0], b = FAMILIES[1];
  assert.ok(searchFamilies(a.examples[0]).includes(a));
  assert.equal(familyWords([]), null);
  assert.deepEqual(familyWords([a.id, b.id]), new Set([...a.words, ...b.words]));
  assert.deepEqual(sanitizeSettings({studyFamilies:[a.id,a.id,"invalid/id"]}).studyFamilies,[a.id]);
});
test("family study intersects deck and POS filters for both new words and reviews", () => {
  const f = FAMILIES[0];
  const words: WordRef[] = [...f.words, "outside"].map((id,order) => ({id,word:id,zh:"词义",ipa:"",cefr:0,topic:0,media:0,order,pos:[order===0?"n.m.":"v."]}));
  const atlas = { words, byId:new Map(words.map(w=>[w.id,w])), topics:[["daily","日常"]] } as Atlas;
  const p = emptyProgress("t");
  p.decks=[{id:"d-test1",name:"test",created:1,words:words.map(w=>w.id)}];
  const s = {...defaultSettings,studyDecks:["d-test1"],studyFamilies:[f.id],studyPos:["noun"]};
  assert.deepEqual(todayPlan(atlas,p,s).fresh,[f.words[0]]);
  for(const w of words) p.cards[w.id]={...review(undefined,Rating.Good,Date.now()),due:0};
  assert.deepEqual(todayPlan(atlas,p,s).due,[f.words[0]]);
  assert.deepEqual(new Set(todayPlan(atlas,p,{...s,studyPos:null}).due),new Set(f.words));
});

test("new cards join existing families, saved links survive backup, and absent words stay suggestions", async () => {
  const { familiesFor } = await import("./families.ts");
  const { withUserData } = await import("../atlas/merge.ts");
  const { sanitizeProgress } = await import("../store/store.ts");
  const f=FAMILIES[0];
  const words: WordRef[]=f.words.map((id,order)=>({id,word:order===0?f.name:f.examples[order-1]??id,zh:"词义",ipa:"",cefr:0,topic:0,media:0,order}));
  const atlas={words,byId:new Map(words.map(w=>[w.id,w]))} as Atlas;
  const p={...emptyProgress("t"),custom:{"u-test123":{w:"nouveau",pos:"adj.",zh:"新",created:1,fam:[f.name,"absentword"]}}};
  const restored=sanitizeProgress(JSON.parse(JSON.stringify(p)),"t");
  const merged=withUserData(atlas,restored.custom,undefined);
  const own=familiesFor(merged,restored).find(g=>g.id==="u-test123")!;
  assert.ok(own.words.includes(f.words[0]));
  assert.ok(own.words.includes("u-test123"));
  assert.ok(own.examples.includes("absentword"));
  assert.equal(merged.byId.has("absentword"),false);
  const cleared={...restored,edits:{[f.id]:{fam:[]}}};
  const again=sanitizeProgress(JSON.parse(JSON.stringify(cleared)),"t");
  assert.deepEqual(again.edits?.[f.id]?.fam,[]);
  assert.equal(familiesFor(merged,again).some(g=>g.id===f.id),false);
});

test("family Chinese glosses survive cleaning without changing membership matching", async () => {
  const { cleanFamily, familyHead, familyPair } = await import("./families.ts");
  assert.deepEqual(cleanFamily(["lier｜连接", "lien｜联系", "lier", null]), ["lier｜连接", "lien｜联系"]);
  assert.equal(familyHead("lier｜连接"), "lier");
  assert.deepEqual(familyPair("infériorité (劣势)"), {fr:"infériorité",zh:"劣势"});
});

test("AI supplementation appends family words and preserves existing Chinese glosses", async () => {
  const { mergeFamily } = await import("./families.ts");
  assert.deepEqual(mergeFamily(["poser｜我写的释义", "imposition", "imposable｜可征税的"], ["poser｜放置", "imposition｜征税", "imposant｜壮观的"]), ["poser｜我写的释义", "imposition｜征税", "imposable｜可征税的", "imposant｜壮观的"]);
  assert.deepEqual(mergeFamily(["poser｜放置"], []), ["poser｜放置"]);
});

test("shared families appear in both decks with deck-specific members and counts", async () => {
  const { scopeFamilies } = await import("./families.ts");
  const groups=[{id:"shared",name:"shared",zh:"共同",words:["a","b","c"],examples:[]},{id:"only",name:"only",zh:"单独",words:["d"],examples:[]}];
  const first=scopeFamilies(groups,new Set(["a","b"]));
  const second=scopeFamilies(groups,new Set(["b","c","d"]));
  assert.deepEqual(first.map(f=>f.id),["shared"]);
  assert.deepEqual(first[0].words,["a","b"]);
  assert.deepEqual(second.map(f=>f.id),["shared","only"]);
  assert.deepEqual(second[0].words,["b","c"]);
  assert.deepEqual(scopeFamilies(groups,new Set()),[]);
  assert.deepEqual(groups[0].words,["a","b","c"]);
});
