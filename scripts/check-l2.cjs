const fs=require("fs");
const lines=fs.readFileSync("data/imports/debutant-lesson02.csv","utf8").trim().split("\n");
const headers=lines[0].split(",");
console.log("Headers:", headers.length, headers.join(" | "));
const rows=lines.slice(1);
console.log("Data rows:", rows.length);
function parseRow(line){
  const out=[]; let cur=""; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ inQ=!inQ; continue; }
    if(ch==="," && !inQ){ out.push(cur); cur=""; continue; }
    cur+=ch;
  }
  out.push(cur);
  return out;
}
const parsed=rows.map((r,i)=>{const p=parseRow(r); return {i:i+2, n:p.length, lemma:p[0], page:p[21], exfr:p[9], pos:p[1]} });
const bad=parsed.filter(r=>r.n!==headers.length);
console.log("Bad rows:", bad.length);
if(bad.length>0) bad.slice(0,3).forEach(b=>console.log(b));
console.log("All lemmas:", parsed.map(r=>r.lemma).join(", "));
