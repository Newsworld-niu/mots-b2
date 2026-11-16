import data from "../data/families.json";
import { foldAccents } from "./accent";
import type { Atlas } from "../atlas/types";
import type { Progress } from "../store/store";
export const FAMILIES = data;
export const familyIds = new Set(data.map((f) => f.id));
export type Family = { id: string; name: string; zh: string; words: string[]; examples: string[] };
export const familyHead = (s: string) => s.split("｜")[0].replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase().normalize("NFC");
export function familyPair(value: string): { fr: string; zh: string } {
  const [fr, ...zh] = value.split("｜");
  const legacy = fr.match(/^(.*?)\s*\(([^)]*[\u4e00-\u9fff][^)]*)\)\s*$/);
  return { fr: familyHead(fr), zh: zh.join("｜").trim() || legacy?.[2] || "" };
}
export function cleanFamily(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const pairs = new Map<string,string>();
  for (const x of v) {
    if (typeof x !== "string") continue;
    const {fr,zh} = familyPair(x);
    if (!fr || fr.length > 80) continue;
    if (!pairs.has(fr) || zh) pairs.set(fr, zh.slice(0, 38));
  }
  return [...pairs].slice(0,12).map(([fr,zh])=>zh ? `${fr}｜${zh}` : fr);
}
/** Resolve explicit links against all current cards; absent words stay suggestions, never become cards. */
export function familiesFor(atlas: Atlas, p: Pick<Progress,"custom"|"edits">): Family[] {
  const byName = new Map<string,string[]>();
  for(const w of atlas.byId.values()) { const k=familyHead(w.word); byName.set(k,[...(byName.get(k)??[]),w.id]); }
  const groups: Family[] = data.map(f => ({...f, words:[...new Set([...f.words.filter(id=>atlas.byId.has(id)), ...[f.name,...f.examples].flatMap(n=>byName.get(familyHead(n))??[])])]}));
  for(const [id,record] of [...Object.entries(p.custom??{}),...Object.entries(p.edits??{})]) {
    const w=atlas.byId.get(id); if(!w || record.fam===undefined) continue;
    const related=cleanFamily(record.fam);
    // A saved override replaces this word's own proposed group, including an explicit empty list.
    const own=groups.findIndex(f=>f.id===id); if(own>=0) groups.splice(own,1);
    if(!related.length) continue;
    const ids=[...new Set([id,...related.flatMap(n=>byName.get(familyHead(n))??[])])];
    const existing=groups.find(f=>[f.name,...f.examples].some(n=>familyHead(n)===familyHead(w.word)) && ids.every(i=>f.words.includes(i)));
    for (const group of groups) {
      if (related.some(n=>familyHead(n)===familyHead(group.name))) {
        group.words=[...new Set([...group.words,...ids])];
        group.examples=[...new Set([...group.examples,w.word,...related])];
      }
    }
    if(!existing) groups.push({id,name:w.word,zh:w.zh,words:ids,examples:related});
  }
  return groups.filter(f=>f.words.length>0);
}
export function familyWords(ids?: string[] | null, groups: Family[] = data): Set<string> | null {
  if (!ids?.length) return null;
  return new Set(groups.filter((f) => ids.includes(f.id)).flatMap((f) => f.words));
}
export function searchFamilies(q: string, groups: Family[] = data) {
  const key = foldAccents(q.trim().toLowerCase());
  return groups.filter((f) => foldAccents([f.name, f.zh, ...f.examples].join(" ").toLowerCase()).includes(key));
}

/** Append suggestions while preserving existing order and the learner's Chinese glosses. */
export function mergeFamily(existing: string[], suggestions: unknown): string[] {
  const merged = new Map<string,string>();
  for (const value of cleanFamily(suggestions)) merged.set(familyHead(value),value);
  const out = existing.map(value => {
    const key=familyHead(value), old=familyPair(value);
    const suggestion=merged.get(key); merged.delete(key);
    return old.zh || !suggestion ? value : suggestion;
  });
  return cleanFamily([...out,...merged.values()]);
}

/** A shared family appears in every deck with at least one member, showing only that deck's words. */
export function scopeFamilies(groups: Family[], ids: Set<string>): Family[] {
  return groups.map(f => ({...f, words:f.words.filter(id=>ids.has(id))})).filter(f=>f.words.length>0);
}
