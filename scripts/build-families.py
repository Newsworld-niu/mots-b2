"""Build explicit French derivation groups from local Wiktionary data, never spelling heuristics."""
import gzip,json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
lex=json.loads((root/'data/lexicon.json').read_text())
entries=[e for e in lex['entries'] if not e.get('aliasOf')]
by={}
for e in entries: by.setdefault(e['lemma'].lower(),[]).append(e['id'])
links={}
source=root/'references/wiktionary-raw/raw.jsonl.gz'
try:
 with gzip.open(source,'rt') as f:
  for line in f:
   e=json.loads(line)
   w=e.get('word','').lower()
   if e.get('lang_code')!='fr' or w not in by: continue
   # Wiktionary derived lists also contain expressions: exclude these, not infer roots.
   for item in e.get('derived',[]):
    v=item.get('word','').lower()
    if v!=w and v in by and not re.search(r'[\s-]',v) and not re.search(r'[\s-]',w): links.setdefault(w,set()).add(v)
except (EOFError, json.JSONDecodeError):
 print("Warning: local dictionary archive is truncated; using complete records recovered before EOF.")
out=[]
for e in entries:
 w=e['lemma'].lower()
 related=links.get(w,set())
 if not related:continue
 ids=list(dict.fromkeys([e['id']]+[i for n in sorted(related) for i in by[n]]))
 if len(ids)<2:continue
 out.append(dict(id=e['id'],name=e['lemma'],zh=next((s['zh'] for s in e['senses'] if s.get('zh')),''),words=ids,examples=sorted(related),source='Wiktionnaire · dérivés'))
# Preserve explicitly curated existing relations, merging duplicate IDs.
existing=json.loads((root/'public/atlas/families.json').read_text())
merged={g['id']:g for g in out}
for g in existing:
 if g['id'] in merged:
  n=merged[g['id']];n['words']=list(dict.fromkeys(n['words']+g['words']));n['examples']=list(dict.fromkeys(n['examples']+g['examples']))
 else:merged[g['id']]=g
out=list(merged.values())
(root/'public/atlas/families.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(f'{len(out)} groups; {len(set(i for g in out for i in g["words"]))} words covered; matched entire lexicon against available local dictionary records')
