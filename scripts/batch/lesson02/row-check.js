import fs from "node:fs";
import { parseCSV, entryKey, fold } from "../../lexicon/core.ts";

const lex = JSON.parse(fs.readFileSync("data/lexicon.json", "utf8"));
const rows = parseCSV(fs.readFileSync("data/imports/debutant-lesson02.csv", "utf8"));
const byKey = new Map(lex.entries.filter(e => !e.aliasOf).map(e => [entryKey(e.lemma, e.pos), e]));

const out = [["row", "lemma", "pos", "printed_page", "lexicon_id", "problems"]];
rows.forEach((r, i) => {
  const key = entryKey(r.lemma, r.pos);
  const e = byKey.get(key);
  const problems = [];
  if (!e) problems.push("NOT_IN_LEXICON");
  else {
    const src = e.sources.find(s => s.kind === "lesson" && s.chapter && s.chapter.includes("第 2 课"));
    if (!src) problems.push("NO_LESSON2_SOURCE");
    else if (String(src.printedPage) !== r.printed_page) problems.push(`PAGE_MISMATCH(${src.printedPage} vs ${r.printed_page})`);
  }
  out.push([i + 1, r.lemma, r.pos, r.printed_page, e ? e.id : "", problems.length ? problems.join(";") : "OK"]);
});

fs.writeFileSync("data/lessons/lesson02-row-check.csv", out.map(r => r.join(",")).join("\n") + "\n");
console.log("Wrote", out.length - 1, "rows");
const bad = out.slice(1).filter(r => r[5] !== "OK");
if (bad.length) {
  console.log("Problems:", bad.length);
  bad.forEach(r => console.log(" ", r.slice(0, 6).join(" | ")));
}
